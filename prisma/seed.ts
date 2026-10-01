/**
 * Seed de datos de operacion. Juan corre `npm run db:seed`.
 *
 * No es un seed de "3 filas para que compile". Es un mes de operacion
 * sintetica pero coherente, pensado para que el panel del coordinador tenga
 * algo real que analizar (RF-PAN-01..08) y para que los reportes por periodo
 * (RF-REP-01..03) tengan historial que graficar.
 *
 * Que cubre:
 *   - Visitas realizadas, pendientes, en ruta, demoradas y canceladas.
 *   - Supervisores activos y asignados, con posicion en el mapa.
 *   - Centros de costo con direccion y coordenadas.
 *   - Escaneos QR verificados y no verificados.
 *   - Novedades con los cuatro estados del ciclo de vida (regla 4), prioridades
 *     y cierre con usuario, hora y accion tomada (CA-07).
 *   - Evidencias sobre los cuatro tipos de dueno polimorfico.
 *   - Checklists diligenciados con items cumplidos, no cumplidos y pendientes,
 *     para que los indicadores de cumplimiento no den 100 %.
 *   - Doble timestamp creible (regla 5, CA-05): `clientCreatedAt` es el reloj
 *     del dispositivo en campo y `receivedAt` llega minutos u horas despues,
 *     segun cuanto estuvo el dispositivo sin senal (RF-OFF-04).
 *
 * Idempotente: borra la operacion sintetica y la vuelve a crear. Los usuarios,
 * centros de costo, QR y plantillas se reconcilian por llave natural, asi que
 * no se duplican.
 *
 * Credenciales de la demo (RF-AUT-01):
 *   supervisor@demo.test  / supervisor123
 *   coordinador@demo.test / coordinador123
 *   Los otros correos usan la misma contrasena segun su rol.
 */

import { PrismaClient, type Prisma } from "@prisma/client";

import { haversineMeters } from "../src/shared/lib/data";
import { hashPassword } from "../src/shared/lib/password";

const prisma = new PrismaClient();

// --------------------------------------------------------------------------
// Utilidades deterministas
//
// El dataset tiene la misma forma en cada ejecucion (el PRNG esta sembrado),
// pero las fechas se anclan al dia de hoy en Bogota para que el dashboard
// siempre muestre la jornada actual y no un mes muerto.
// --------------------------------------------------------------------------

function createRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const random = createRng(20261001);

function randInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)]!;
}

function chance(probability: number): boolean {
  return random() < probability;
}

/** Pesos para elegir un valor proporcionalmente. */
function pickWeighted<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;

  for (const [value, weight] of entries) {
    roll -= weight;

    if (roll <= 0) {
      return value;
    }
  }

  return entries[entries.length - 1]![0];
}

// Colombia no aplica horario de verano: UTC-5 todo el ano.
const BOGOTA_OFFSET_HOURS = 5;

/** Medianoche de hoy en America/Bogota. */
function bogotaTodayMidnight(): Date {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

  return new Date(`${today}T00:00:00.000-05:00`);
}

const TODAY_MIDNIGHT = bogotaTodayMidnight();

/**
 * Un instante en Bogota. `dayOffset` cuenta dias desde hoy: -30 es hace un
 * mes, +7 es la proxima semana.
 *
 * `TODAY_MIDNIGHT` ya es un instante absoluto (medianoche de Bogota, que en UTC
 * son las 05:00). Sumarle horas de reloj local lo lleva a la hora pedida. No
 * hay que volver a sumar el desfase: hacerlo correria todo cinco horas hacia
 * adelante y volveria la jornada "de hoy" en una jornada que todavia no ocurrio.
 */
function bogotaDate(dayOffset: number, hour: number, minute = 0): Date {
  return new Date(
    TODAY_MIDNIGHT.getTime() +
      dayOffset * 86_400_000 +
      (hour * 60 + minute) * 60_000,
  );
}

/** 0 = domingo ... 6 = sabado. */
function bogotaWeekday(dayOffset: number): number {
  // Mediodia en Bogota cae el mismo dia UTC, asi que getUTCDay es correcto.
  return new Date(bogotaDate(dayOffset, 12)).getUTCDay();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE);
}

// --------------------------------------------------------------------------
// Geometria
// --------------------------------------------------------------------------

interface Point {
  lat: number;
  lng: number;
}

interface GeoCheck extends Point {
  distanceMeters: number;
  verified: boolean;
  outOfRange: boolean;
}

/** Desplaza un punto `meters` en direccion `bearing` (radianes). */
function offsetPoint(origin: Point, meters: number, bearing: number): Point {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng =
    metersPerDegreeLat * Math.cos((origin.lat * Math.PI) / 180) || 1;

  return {
    lat: origin.lat + (meters * Math.cos(bearing)) / metersPerDegreeLat,
    lng: origin.lng + (meters * Math.sin(bearing)) / metersPerDegreeLng,
  };
}

/**
 * Geolocalizacion de una visita contra su centro de costo.
 *
 * La distancia se mide con `haversineMeters`, la misma funcion que usa
 * `recalculateVisitGeofence` en el servidor, y los flags salen de esa medicion.
 * Asi el seed no puede dejar un `checkInVerified: true` con 300 m de distancia.
 */
function geoAgainst(
  center: Point,
  distanceTarget: number,
  bearing: number,
): GeoCheck {
  const point = offsetPoint(center, distanceTarget, bearing);
  const distanceMeters = haversineMeters(point, center);

  return {
    ...point,
    distanceMeters,
    verified: distanceMeters <= 50,
    outOfRange: distanceMeters > 50,
  };
}

/**
 * Estado geo cuando el instante no ocurrio todavia.
 *
 * Importante: una visita que no ha hecho check-in no puede traer
 * `checkInOutOfRange: true`. El flag describe un hecho que todavia no paso, y
 * el panel lo contaria como alerta falsa.
 */
const NO_GEO = {
  lat: null,
  lng: null,
  accuracyM: null,
  distanceMeters: null,
  verified: false,
  outOfRange: false,
} as const;

/**
 * Distribucion de check-ins de una visita.
 * - La mayoria dentro del radio de 50 m.
 * - Una de cada ocho claramente fuera (alertas RF-PAN-08).
 * - Una de cada veinticinco sin coordenadas: el usuario no concedio GPS
 *   (RNF-10). El check-in se guarda igual, solo que sin ubicacion.
 */
function visitGeo(center: Point): {
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  distanceMeters: number | null;
  verified: boolean;
  outOfRange: boolean;
} {
  if (chance(0.04)) {
    return {
      lat: null,
      lng: null,
      accuracyM: null,
      distanceMeters: null,
      verified: false,
      outOfRange: false,
    };
  }

  const outOfRange = chance(0.13);
  const geo = geoAgainst(
    center,
    outOfRange ? randInt(120, 650) : randInt(4, 44),
    random() * Math.PI * 2,
  );

  return {
    lat: Number(geo.lat.toFixed(6)),
    lng: Number(geo.lng.toFixed(6)),
    // La precision reportada por el dispositivo:related a la distancia real,
    // un GPS de campo no es perfecto.
    accuracyM: Number((3 + random() * (outOfRange ? 28 : 14)).toFixed(1)),
    distanceMeters: Number(geo.distanceMeters.toFixed(1)),
    verified: geo.verified,
    outOfRange: geo.outOfRange,
  };
}

// --------------------------------------------------------------------------
// Catalogo de la operacion
// --------------------------------------------------------------------------

const PASSWORD = {
  supervisor: "supervisor123",
  coordinador: "coordinador123",
} as const;

const COORDINATORS = [
  { email: "coordinador@demo.test", name: "Coordinador Demo" },
  { email: "coord.operaciones@demo.test", name: "Maria Fernanda Cruz" },
] as const;

const SUPERVISORS = [
  { email: "supervisor@demo.test", name: "Supervisor Demo" },
  { email: "ana.torres@demo.test", name: "Ana Torres" },
  { email: "carlos.ramirez@demo.test", name: "Carlos Ramirez" },
  { email: "laura.gomez@demo.test", name: "Laura Gomez" },
  { email: "diego.martinez@demo.test", name: "Diego Martinez" },
  { email: "sofia.perez@demo.test", name: "Sofia Perez" },
] as const;

const COST_CENTERS = [
  {
    name: "Plaza Norte",
    address: "Calle 100 # 45-60, Chapinero",
    lat: 4.710989,
    lng: -74.07209,
    template: "Aseo General",
  },
  {
    name: "Plaza Sur",
    address: "Avenida 68 # 12-35, Kennedy",
    lat: 4.698226,
    lng: -74.056098,
    template: "Aseo General",
  },
  {
    name: "Parque Centro",
    address: "Carrera 7 # 32-16, La Candelaria",
    lat: 4.706812,
    lng: -74.068127,
    template: "Aseo General",
  },
  {
    name: "Galerias Centenario",
    address: "Calle 71 # 6-30, Chapinero",
    lat: 4.712345,
    lng: -74.068234,
    template: "Limpieza Profunda",
  },
  {
    name: "Campus Universidad Nacional",
    address: "Calle 45 # 74-36, La Candelaria",
    lat: 4.57683,
    lng: -74.10092,
    template: "Control de Residuos",
  },
  {
    name: "Hospital San Rafael",
    address: "Calle 45 # 50-30, Teusaquillo",
    lat: 4.59682,
    lng: -74.08393,
    template: "Control de Residuos",
  },
] as const;

/** Radio por defecto del SDD (RF-QR-01). */
const QR_RADIUS_METERS = 50;

/** Horarios de la jornada en Bogota. */
const SHIFT_HOURS = [7, 9, 11, 14, 16] as const;

interface TemplateSeed {
  name: string;
  items: readonly (readonly [string, boolean])[];
}

/**
 * `required: false` marca items que no bloquean el cierre de la visita.
 * CA-02 solo exige que no queden PENDING los obligatorios, asi que un mix
 * hace que el indicador de cumplimiento tenga sentido.
 */
const TEMPLATES: readonly TemplateSeed[] = [
  {
    name: "Aseo General",
    items: [
      ["Barrer y trapear el area asignada", true],
      ["Reponer papel higienico en todos los puntos", true],
      ["Limpiar espejos y lavamanos", true],
      ["Retirar residuos y revisar contenedores", true],
      ["Verificar estado del piso y la iluminacion", true],
      ["Registrar novedades encontrados", false],
    ],
  },
  {
    name: "Limpieza Profunda",
    items: [
      ["Desinfectar superficies de alto contacto", true],
      ["Limpiar vidrios y bardas interiores", true],
      ["Reponer kit de aseo del punto", true],
      ["Registrar hallazgos del area", false],
    ],
  },
  {
    name: "Control de Residuos",
    items: [
      ["Clasificar residuos segregados por tipo", true],
      ["Registrar peso de residuos especiales", true],
      ["Verificar rotulos de los contenedores", true],
      ["Reportar residuos peligrosos", false],
    ],
  },
];

const CHECKOUT_NOTES = [
  "Area limpia, sin incidentes.",
  "Se repuso stock de papel y jabon.",
  "Quedo pendiente el lavado de un filtro.",
  "Se escalo a mantenimiento la luminaria del pasillo.",
  "Sin novedades, entrega completa.",
  "Se encontro agua acumulada cerca de la entrada.",
] as const;

const VISIT_NOTES = [
  "Equipo de dos personas con carro de aseo.",
  "Turno de manana, zona de alto trafico.",
  "Visita reprogramada por clima.",
  "Coordinacion previa con el administrador del centro.",
  "Se trabajo por sectores para no bloquear el acceso.",
] as const;

const FAILURE_COMMENTS = [
  "No alcanzo a reponer en todos los puntos.",
  "El contenedor estaba lleno y no se pudo retirar.",
  "Luminaria fundida, se reporto a mantenimiento.",
  "Faltante de insumos, se solicito reposicion.",
  "El area estaba ocupada, se intervino luego.",
] as const;

const NOVELTY_CATALOG = [
  {
    description: "Fuga de agua en el punto de agua del pasillo norte.",
    priority: "HIGH",
    resolution: "Se cerro la valvula y se selló la union.",
  },
  {
    description: "Contenedor de residuos solidos desbordado en la entrada principal.",
    priority: "MEDIUM",
    resolution: "Se retiro el contenedor y se aumento la frecuencia de recoleccion.",
  },
  {
    description: "Luminaria fundida en el acceso principal del centro de costo.",
    priority: "LOW",
    resolution: "Se Cambio el tubo y se reporto el mantenimiento preventivo.",
  },
  {
    description: "Piso danado con marca de agua junto a la escalera de servicio.",
    priority: "HIGH",
    resolution: "Se señaleso la zona y el area de mantenimiento reparo el piso.",
  },
  {
    description: "Puerta del deposito sin cerrar, riesgo de ingreso de personal ajento.",
    priority: "CRITICAL",
    resolution: "Se aseguro la puerta y se instalo un nuevo cierre.",
  },
  {
    description: "Faltante de papel higienico en dos puntos de servicio.",
    priority: "LOW",
    resolution: "Se repuso el inventario en la ruta siguiente.",
  },
  {
    description: "Residuo peligroso sin señalizar en el deposito temporal.",
    priority: "CRITICAL",
    resolution: "Se señalizo, se segrego y se coordino la recoleccion especial.",
  },
  {
    description: "Muro con grafitti en el acceso de visitantes.",
    priority: "MEDIUM",
    resolution: "Seprogramo la limpieza profunda del muro.",
  },
  {
    description: "Extractor de aire con ruido anormal en la cocina.",
    priority: "MEDIUM",
    resolution: "Mantenimiento limpio el extractor y cambio el ventilador.",
  },
  {
    description: "Escalera mecanica fuera de servicio.",
    priority: "HIGH",
    resolution: "Se reporto al administrador y se delimito el acceso.",
  },
  {
    description: "Soterramiento en la red de aguas residuales del bathrooms.",
    priority: "CRITICAL",
    resolution: "Cuadrilla de mantenimiento ejecuto la limpieza del tuberia.",
  },
  {
    description: "Ventilacion deficiente en el archivo, humedad en el piso.",
    priority: "MEDIUM",
    resolution: "Se instalo un extractor y se programo la deshumidificacion.",
  },
  {
    description: "Ruido excessivo de la planta electrica en horario nocturno.",
    priority: "LOW",
    resolution: "Se ajusto el horario de encendido de la planta.",
  },
  {
    description: "Falta de rotulacion de rutas de evacuacion.",
    priority: "HIGH",
    resolution: "Se instalaron las senales y se capacito al personal.",
  },
] as const;

const CLEAN_NOTES = [
  "Sin novedad en el recorrido.",
  "Recorrido completo sin incidencias.",
  "Sin observaciones relevantes.",
] as const;

// --------------------------------------------------------------------------
// Limpieza previa
// --------------------------------------------------------------------------

/**
 * Borra toda la operacion sintetica y la reconstruye.
 *
 * El orden respeta las llaves foraneas: `ChecklistItemResult` y `Novelty`
 * apuntan a `Visit` con ON DELETE RESTRICT, y `QrScan` tambien. `Evidence` no
 * tiene FK (dueno polimorfico), asi que se puede borrar en cualquier momento.
 *
 * Solo se borran tablas que este seed reconstruye. Usuarios, centros de costo,
 * QR y plantillas se reconcilian por llave natural y sobreviven.
 */
async function resetOperationalData(): Promise<void> {
  await prisma.evidence.deleteMany();
  await prisma.checklistItemResult.deleteMany();
  await prisma.novelty.deleteMany();
  await prisma.qrScan.deleteMany();
  await prisma.visit.deleteMany();
}

// --------------------------------------------------------------------------
// Catalogo
// --------------------------------------------------------------------------

interface Catalog {
  coordinators: { id: string }[];
  supervisors: { id: string; name: string }[];
  costCenters: { id: string; name: string; lat: number; lng: number }[];
  templates: Map<string, { id: string; items: { id: string; label: string; required: boolean }[] }>;
  qrPointsByCostCenter: Map<
    string,
    { id: string; code: string; lat: number; lng: number; isActive: boolean }[]
  >;
}

async function seedCatalog(): Promise<Catalog> {
  const coordinators: { id: string }[] = [];

  for (const person of COORDINATORS) {
    const passwordHash = await hashPassword(PASSWORD.coordinador);
    const user = await prisma.user.upsert({
      where: { email: person.email },
      create: { ...person, role: "COORDINADOR", passwordHash },
      update: { name: person.name, role: "COORDINADOR", passwordHash },
      select: { id: true },
    });

    coordinators.push(user);
  }

  const supervisors: { id: string; name: string }[] = [];

  for (const person of SUPERVISORS) {
    const passwordHash = await hashPassword(PASSWORD.supervisor);
    const user = await prisma.user.upsert({
      where: { email: person.email },
      create: { ...person, role: "SUPERVISOR", passwordHash },
      update: { name: person.name, role: "SUPERVISOR", passwordHash },
      select: { id: true, name: true },
    });

    supervisors.push(user);
  }

  // --- Plantillas de checklist (RF-SUP-01, RF-ASI-03) ---
  // `ChecklistTemplate.name` no es unique en el schema, asi que se busca antes
  // de crear para no duplicar la plantilla.
  const templates = new Map<
    string,
    { id: string; items: { id: string; label: string; required: boolean }[] }
  >();

  for (const seed of TEMPLATES) {
    const template =
      (await prisma.checklistTemplate.findFirst({ where: { name: seed.name } })) ??
      (await prisma.checklistTemplate.create({
        data: {
          name: seed.name,
          createdById: coordinators[0]!.id,
          isActive: true,
        },
      }));

    const items: { id: string; label: string; required: boolean }[] = [];

    for (const [index, [label, required]] of seed.items.entries()) {
      const item = await prisma.checklistTemplateItem.upsert({
        where: { templateId_position: { templateId: template.id, position: index + 1 } },
        create: { templateId: template.id, position: index + 1, label, required },
        update: { label, required },
      });

      items.push({ id: item.id, label, required });
    }

    // Items que quedaron en la base de una corrida anterior con la plantilla
    // mas larga.
    await prisma.checklistTemplateItem.deleteMany({
      where: { templateId: template.id, position: { gt: seed.items.length } },
    });

    templates.set(seed.name, { id: template.id, items });
  }

  // --- Centros de costo (RF-ASI-02) ---
  const costCenters: { id: string; name: string; lat: number; lng: number }[] = [];

  for (const seed of COST_CENTERS) {
    const template = templates.get(seed.template)!;
    const center = await prisma.costCenter.findFirst({ where: { name: seed.name } });

    if (center === null) {
      costCenters.push(
        await prisma.costCenter.create({
          data: {
            name: seed.name,
            address: seed.address,
            lat: seed.lat,
            lng: seed.lng,
            checklistTemplateId: template.id,
          },
        }),
      );
      continue;
    }

    costCenters.push(
      await prisma.costCenter.update({
        where: { id: center.id },
        data: {
          address: seed.address,
          lat: seed.lat,
          lng: seed.lng,
          checklistTemplateId: template.id,
        },
      }),
    );
  }

  // --- Puntos QR (RF-QR-01, RF-QR-02) ---
  // Tres por centro. Un par queda inactivo para que el escaner practique el
  // caso "existe pero esta inactivo" (RF-QR-06) sin borrarlo.
  const qrPointsByCostCenter = new Map<
    string,
    { id: string; code: string; lat: number; lng: number; isActive: boolean }[]
  >();

  for (const center of costCenters) {
    const points: { id: string; code: string; lat: number; lng: number; isActive: boolean }[] = [];
    const slug = center.name.replace(/\s+/g, "-").toUpperCase();

    for (let area = 1; area <= 3; area += 1) {
      const code = `QR-${slug}-${area}`;
      const point = offsetPoint(center, area * 12, (area * Math.PI) / 3);
      const isActive = !(code === "QR-PLAZA-SUR-3" || code === "QR-HOSPITAL-SAN-RAFAEL-3");

      const row = await prisma.qrPoint.upsert({
        where: { code },
        create: {
          code,
          costCenterId: center.id,
          areaName: `Area ${area}`,
          lat: Number(point.lat.toFixed(6)),
          lng: Number(point.lng.toFixed(6)),
          radiusMeters: QR_RADIUS_METERS,
          isActive,
        },
        update: {
          costCenterId: center.id,
          areaName: `Area ${area}`,
          lat: Number(point.lat.toFixed(6)),
          lng: Number(point.lng.toFixed(6)),
          radiusMeters: QR_RADIUS_METERS,
          isActive,
        },
      });

      points.push({
          id: row.id,
          code: row.code,
          lat: row.lat,
          lng: row.lng,
          isActive: row.isActive,
        });
    }

    qrPointsByCostCenter.set(center.id, points);
  }

  return { coordinators, supervisors, costCenters, templates, qrPointsByCostCenter };
}

// --------------------------------------------------------------------------
// Generacion de la jornada
// --------------------------------------------------------------------------

const DAYS_OF_HISTORY = 30;
const DAYS_AHEAD = 7;

const STATUS_BY_AGE = {
  past: [
    ["COMPLETED", 80] as const,
    ["CANCELLED", 7] as const,
    ["ASSIGNED", 13] as const, // demoradas: RF-PAN-08
  ],
  yesterday: [
    ["COMPLETED", 70] as const,
    ["IN_PROGRESS", 15] as const,
    ["ASSIGNED", 15] as const,
  ],
  today: [
    ["COMPLETED", 45] as const,
    ["IN_PROGRESS", 20] as const,
    ["ASSIGNED", 35] as const,
  ],
  future: [["ASSIGNED", 100] as const],
} as const;

function statusForDay(dayOffset: number): "COMPLETED" | "IN_PROGRESS" | "ASSIGNED" | "CANCELLED" {
  if (dayOffset < -1) return pickWeighted(STATUS_BY_AGE.past);
  if (dayOffset === -1) return pickWeighted(STATUS_BY_AGE.yesterday);
  if (dayOffset === 0) return pickWeighted(STATUS_BY_AGE.today);
  return pickWeighted(STATUS_BY_AGE.future);
}

/**
 * Latencia de sincronizacion (RF-OFF-04).
 * Lo normal es que el dispositivo suba casi al rato. Una de cada ocho
 * operaciones llega bufferizada, y una de cada treinta arrives al dia
 * siguiente porque el equipo estuvo todo el turno sin senal.
 */
function syncLatencyMs(): number {
  const roll = random();

  if (roll < 0.85) return randInt(20, 300) * 1000;
  if (roll < 0.97) return randInt(20, 180) * MINUTE;
  return randInt(3, 30) * HOUR;
}

/** Cantidad de visitas que se programan para un dia. */
function visitsForDay(dayOffset: number): number {
  const weekday = bogotaWeekday(dayOffset);

  if (weekday === 0) return randInt(0, 1); // domingo
  if (weekday === 6) return randInt(1, 3); // sabado

  if (dayOffset === 0) return randInt(3, 5);
  if (dayOffset > 0) return randInt(2, 4);

  return randInt(2, 4);
}

/**
 * Estado del checklist de una visita.
 *
 * Las visitas completadas marcan casi todo, pero una de cada seis deja uno o
 * dos items obligatorios sin tocar: es lo que hace que
 * `checklistDonePercent` baje de 100 y que `findPendingRequiredItems` tenga
 * algo que reportar (CA-02).
 */
function checklistOutcomeFor(
  status: "COMPLETED" | "IN_PROGRESS" | "ASSIGNED" | "CANCELLED",
): { markRatio: number; abandonedItems: number } {
  if (status === "CANCELLED") return { markRatio: 0, abandonedItems: 0 };
  if (status === "ASSIGNED") return { markRatio: 0, abandonedItems: 0 };
  if (status === "IN_PROGRESS") return { markRatio: 0.55, abandonedItems: 0 };

  return {
    markRatio: chance(0.82) ? 1 : randInt(0.55, 0.9),
    abandonedItems: chance(0.18) ? randInt(1, 2) : 0,
  };
}

function noveltyStatusFor(ageInDays: number): "OPEN" | "IN_REVIEW" | "RESOLVED" {
  if (ageInDays > 10) return chance(0.9) ? "RESOLVED" : "IN_REVIEW";

  if (ageInDays > 3) {
    return pickWeighted([
      ["RESOLVED", 65],
      ["IN_REVIEW", 22],
      ["OPEN", 13],
    ]);
  }

  // Lo reciente casi nunca esta cerrado: es lo que el coordinador tiene que
  // ver en la bandeja de alertas (RF-NOV-03, RF-PAN-05).
  return pickWeighted([
    ["RESOLVED", 18],
    ["IN_REVIEW", 40],
    ["OPEN", 42],
  ]);
}

// --------------------------------------------------------------------------
// Siembra
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  await resetOperationalData();

  const catalog = await seedCatalog();

  let sequence = 0;
  let noveltySequence = 0;
  let evidenceSequence = 0;

  const stats = {
    visitsByStatus: { ASSIGNED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 },
    outOfRangeVisits: 0,
    withoutGps: 0,
    verifiedScans: 0,
    rejectedScans: 0,
    noveltiesByStatus: { OPEN: 0, IN_REVIEW: 0, RESOLVED: 0 },
    evidenceByOwner: { VISIT: 0, NOVELTY: 0, QR_SCAN: 0, CHECKLIST_ITEM: 0 },
    checklistDone: 0,
    checklistNotDone: 0,
    checklistPending: 0,
  };

  const createdEvidence: Prisma.EvidenceCreateManyInput[] = [];

  const nowMs = Date.now();

  /** Minutos transcurridos desde la medianoche de Bogota de hoy. */
  function bogotaMinutesNow(): number {
    return Math.floor((nowMs - TODAY_MIDNIGHT.getTime()) / 60_000);
  }

  /**
   * Instante de Bogota a partir de minutos desde la medianoche del dia.
   * Necesario para las visitas en ruta: se.placean hacia atras desde la hora
   * actual, no en un turno fijo, asi siempre hay(check-in ya registrado.
   */
  function bogotaInstant(dayOffset: number, minutesFromMidnight: number): Date {
    return new Date(
      TODAY_MIDNIGHT.getTime() +
        dayOffset * 86_400_000 +
        minutesFromMidnight * 60_000,
    );
  }

  /**
   * Encola una evidencia.
   *
   * El `receivedAt` se deriva del `clientCreatedAt` de la propia foto y no del
   * hecho que la origino. Si se calculara desde el evento padre, una foto
   * tomada un minuto despues del check-out "viajaria" recibida antes de
   * tomarse, violando la regla 5.
   *
   * RNF-14: la foto la subio el supervisor de la ruta. En produccion lo
   * pone el servidor desde la sesion (`upsertEvidence`), asi que el seed lo
   * fija igual: autor y dueno de la visita son la misma persona.
   */
  function pushEvidence(input: {
    ownerType: "VISIT" | "NOVELTY" | "QR_SCAN" | "CHECKLIST_ITEM";
    ownerId: string;
    url: string;
    clientCreatedAt: Date;
    capturedById: string;
  }): void {
    // Ni la toma ni la recepcion pueden caer en el futuro. Una visita que
    // acaba de cerrarse puede tener el check-out unos minutos por delante del
    // reloj del seed, y una foto "tomada" despues de eso seria imposible.
    const takenAt = new Date(Math.min(input.clientCreatedAt.getTime(), nowMs - MINUTE));
    const receivedAt = new Date(
      Math.min(takenAt.getTime() + syncLatencyMs(), nowMs),
    );

    createdEvidence.push({
      clientId: `demo-e-${evidenceSequence++}`,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      url: input.url,
      clientCreatedAt: takenAt,
      receivedAt,
      capturedById: input.capturedById,
    });

    stats.evidenceByOwner[input.ownerType] += 1;
  }

  for (let day = -DAYS_OF_HISTORY; day <= DAYS_AHEAD; day += 1) {
    for (let slot = 0; slot < visitsForDay(day); slot += 1) {
      sequence += 1;

      const visitSeq = String(sequence).padStart(4, "0");
      const supervisor = pick(catalog.supervisors);
      const center = pick(catalog.costCenters);
      const template = catalog.templates.get(
        COST_CENTERS.find((entry) => entry.name === center.name)!.template,
      )!;

      // Las dos primeras visitas del dia de hoy quedan en ruta a proposito: sin
      // ellas el panel no muestra ningun supervisor "EN_RUTA" ni ninguna visita
      // en progreso, que es justo lo que hay que ver en una demo. Se programan
      // hacia atras desde la hora actual para que el check-in ya haya pasado
      // sin importar a que hora se corra el seed.
      const forceOnRoute = day === 0 && slot < 2;
      const hour = forceOnRoute ? pick([7, 9] as const) : pick(SHIFT_HOURS);
      const scheduledAt = forceOnRoute
        ? bogotaInstant(0, Math.max(7 * 60, bogotaMinutesNow() - randInt(30, 95)))
        : bogotaDate(day, hour, randInt(0, 45));
      const onRoute = forceOnRoute || (day === 0 && hour <= bogotaMinutesNow() / 60 && chance(0.2));
      const proposed = onRoute ? "IN_PROGRESS" : statusForDay(day);

      // --- Tiempos de campo ---
      const lateStart = chance(0.14); // RF-PAN-08: visita demorada
      const tentativeCheckIn = addMinutes(
        scheduledAt,
        lateStart ? randInt(35, 140) : randInt(1, 22),
      );

      // Una visita no puede haberse completado antes de su check-in, y el
      // check-in no puede estar en el futuro. Si el turno caia mas tarde que
      // la hora actual, la visita sigue pendiente: no se Fabrica un pasado que
      // todavia no ocurrio.
      const afterCheckIn =
        proposed !== "ASSIGNED" && tentativeCheckIn.getTime() > nowMs - 5 * MINUTE
          ? ("ASSIGNED" as const)
          : proposed;
      const started = afterCheckIn === "COMPLETED" || afterCheckIn === "IN_PROGRESS";
      const checkInAt = started ? tentativeCheckIn : null;

      // Una de cada veinte se alarga: son las que aparecen como demoradas en
      // el reporte de duracion.
      const duration = chance(0.05) ? randInt(150, 260) : randInt(35, 110);
      const tentativeCheckOut = checkInAt !== null ? addMinutes(checkInAt, duration) : null;
      // Igual con el cierre: una visita terminada despues de "ahora" sigue en
      // ruta, no completada.
      const status =
        tentativeCheckOut !== null && tentativeCheckOut.getTime() > nowMs
          ? ("IN_PROGRESS" as const)
          : afterCheckIn;
      const checkOutAt = status === "COMPLETED" ? tentativeCheckOut : null;

      const checkInGeo = checkInAt === null ? NO_GEO : visitGeo(center);
      const checkOutGeo = checkOutAt === null ? NO_GEO : visitGeo(center);

      if (started && checkInGeo.lat === null) stats.withoutGps += 1;
      if (checkInGeo.outOfRange || checkOutGeo.outOfRange) stats.outOfRangeVisits += 1;

      // --- Regla 5: reloj del dispositivo y hora de recepcion ---
      // El dispositivo crea el registro al iniciar la visita. Si todavia no
      // empieza, lo que hay es la precarga del dia (plantilla + QR), y esa
      // ocurre en las horas previas, no dias antes de la fecha programada.
      const startedPreload =
        checkInAt !== null
          ? new Date(checkInAt.getTime() - randInt(30, 240) * 1000)
          : new Date(scheduledAt.getTime() - randInt(2, 20) * HOUR);
      const clientCreatedAt =
        startedPreload.getTime() > nowMs - 6 * HOUR
          ? new Date(nowMs - randInt(3, 60) * HOUR)
          : startedPreload;
      // La recepcion nunca puede estar en el futuro. En los historicos esto no
      // aplica; acota el caso "el dispositivo acaba de salir de una zona sin
      // senal y sube el historico".
      const receivedAt = new Date(
        Math.min(clientCreatedAt.getTime() + syncLatencyMs(), nowMs),
      );

      const visitData: Prisma.VisitUncheckedCreateInput = {
        clientId: `demo-v-${visitSeq}`,
        supervisorId: supervisor.id,
        costCenterId: center.id,
        checklistTemplateId: template.id,
        status,
        scheduledAt,
        checkInLat: checkInGeo.lat,
        checkInLng: checkInGeo.lng,
        checkInAccuracyM: checkInGeo.accuracyM,
        checkInAt,
        checkInDistanceM: checkInGeo.distanceMeters,
        checkInVerified: checkInGeo.verified,
        checkInOutOfRange: checkInGeo.outOfRange,
        checkOutLat: checkOutGeo.lat,
        checkOutLng: checkOutGeo.lng,
        checkOutAccuracyM: checkOutGeo.accuracyM,
        checkOutAt,
        checkOutDistanceM: checkOutGeo.distanceMeters,
        checkOutVerified: checkOutGeo.verified,
        checkOutOutOfRange: checkOutGeo.outOfRange,
        checkOutNotes:
          status === "COMPLETED"
            ? chance(0.55)
              ? pick(CHECKOUT_NOTES)
              : null
            : null,
        notes: chance(0.4) ? pick(VISIT_NOTES) : null,
        clientCreatedAt,
        receivedAt,
      };

      const visit = await prisma.visit.create({ data: visitData });
      stats.visitsByStatus[status] += 1;

      // --- Escaneos QR (RF-QR-03) ---
      if (started && checkInAt !== null) {
        const points = catalog.qrPointsByCostCenter.get(center.id) ?? [];
        // RF-QR-06: no se escanea un punto inactivo. Si el centro entero
        // estuviera inactivo se cae a la lista completa para que la visita
        // no se quede sin evidencia de campo.
        const activePoints = points.filter((point) => point.isActive);
        const pool = activePoints.length > 0 ? activePoints : points;
        const scanCount = Math.min(pool.length, randInt(1, 3));

        for (let index = 0; index < scanCount; index += 1) {
          const point = pool[index]!;
          const scanSeq = `${visitSeq}-${index + 1}`;
          const scanAt = addMinutes(checkInAt, randInt(2, Math.max(3, duration - 5)));
          const outOfRange = chance(0.15);
          const geo = geoAgainst(
            { lat: point.lat, lng: point.lng },
            outOfRange ? randInt(70, 260) : randInt(2, 40),
            random() * Math.PI * 2,
          );

          const scan = await prisma.qrScan.create({
            data: {
              clientId: `demo-s-${scanSeq}`,
              qrPointId: point.id,
              visitId: visit.id,
              distanceMeters: Number(geo.distanceMeters.toFixed(1)),
              verified: geo.verified,
              clientCreatedAt: new Date(scanAt.getTime() - randInt(20, 90) * 1000),
              receivedAt: new Date(scanAt.getTime() + syncLatencyMs()),
            },
          });

          if (geo.verified) {
            stats.verifiedScans += 1;
          } else {
            stats.rejectedScans += 1;
          }

          if (chance(0.18)) {
            pushEvidence({
              ownerType: "QR_SCAN",
              ownerId: scan.id,
              url: `/uploads/demo/escaneo-${scanSeq}.jpg`,
              clientCreatedAt: new Date(scanAt.getTime() + randInt(10, 90) * 1000),
              capturedById: supervisor.id,
            });
          }
        }
      }

      // --- Checklist (RF-SUP-01/02, CA-02) ---
      const outcome = checklistOutcomeFor(status);

      if (outcome.markRatio > 0) {
        const marked = Math.max(1, Math.round(template.items.length * outcome.markRatio));
        const abandoned = new Set(
          Array.from(
            { length: Math.min(outcome.abandonedItems, template.items.length - marked) },
            () => randInt(marked, template.items.length - 1),
          ),
        );

        for (const [index, item] of template.items.entries()) {
          if (index >= marked || abandoned.has(index)) continue;

          const notDone = chance(0.16);
          const markedAt =
            checkInAt === null
              ? clientCreatedAt
              : new Date(
                  checkInAt.getTime() +
                    randInt(1, Math.max(2, (checkOutAt?.getTime() ?? checkInAt.getTime()) / MINUTE - checkInAt.getTime() / MINUTE)) *
                      MINUTE,
                );

          const result = await prisma.checklistItemResult.create({
            data: {
              clientId: `demo-c-${visitSeq}-${index + 1}`,
              visitId: visit.id,
              itemId: item.id,
              status: notDone ? "NOT_DONE" : "DONE",
              comment: notDone ? pick(FAILURE_COMMENTS) : null,
              clientCreatedAt: markedAt,
              receivedAt: new Date(markedAt.getTime() + syncLatencyMs()),
            },
          });

          if (notDone) {
            stats.checklistNotDone += 1;
          } else {
            stats.checklistDone += 1;
          }

          // Un item no cumplido casi siempre lleva foto: es la evidencia de
          // por que quedo pendiente.
          if (notDone && chance(0.65)) {
            pushEvidence({
              ownerType: "CHECKLIST_ITEM",
              ownerId: result.id,
              url: `/uploads/demo/checklist-${visitSeq}-${index + 1}.jpg`,
              clientCreatedAt: new Date(markedAt.getTime() + randInt(30, 240) * 1000),
              capturedById: supervisor.id,
            });
          }
        }

        const unmarked = template.items.length - marked + abandoned.size;
        stats.checklistPending += unmarked;
      }

      // --- Evidencias de la visita ---
      if (status === "COMPLETED" && checkInAt !== null && checkOutAt !== null && chance(0.7)) {
        const shots = randInt(1, 2);

        for (let index = 0; index < shots; index += 1) {
          pushEvidence({
            ownerType: "VISIT",
            ownerId: visit.id,
            url: `/uploads/demo/visita-${visitSeq}-${index + 1}.jpg`,
            clientCreatedAt: new Date(checkInAt.getTime() + randInt(1, duration) * MINUTE),
            capturedById: supervisor.id,
          });
        }
      }

      // --- Novedades (RF-NOV-01, regla 4) ---
      // Cuanto mas reciente la visita, mas novedades: lo que paso hoy es lo que el
      // coordinador tiene abierto en la bandeja.
      const noveltyChance =
        status === "ASSIGNED" || status === "CANCELLED" ? 0.02 : day >= -1 ? 0.6 : 0.3;

      if (chance(noveltyChance)) {
        noveltySequence += 1;
        const catalogEntry = pick(NOVELTY_CATALOG);
        const noveltyAt =
          checkInAt === null
            ? addMinutes(scheduledAt, randInt(5, 40))
            : new Date(
                checkInAt.getTime() +
                  randInt(2, Math.max(3, (checkOutAt?.getTime() ?? checkInAt.getTime()) / MINUTE - checkInAt.getTime() / MINUTE)) *
                    MINUTE,
              );

        const ageInDays = Math.max(
          0,
          (TODAY_MIDNIGHT.getTime() - noveltyAt.getTime()) / 86_400_000,
        );
        const noveltyStatus = noveltyStatusFor(ageInDays);

        // Sin GPS conceded no hay coordenadas (RNF-10).
        const hasGeo = chance(0.85);
        const geo = hasGeo
          ? visitGeo({ lat: center.lat, lng: center.lng })
          : { lat: null, lng: null, accuracyM: null, distanceMeters: null, verified: false, outOfRange: false };

        const resolved =
          noveltyStatus === "RESOLVED"
            ? {
                closedAt: new Date(noveltyAt.getTime() + randInt(2, 60) * HOUR),
                closedById: pick(catalog.coordinators).id,
                resolutionAction: catalogEntry.resolution,
              }
            : { closedAt: null, closedById: null, resolutionAction: null };

        const novelty = await prisma.novelty.create({
          data: {
            clientId: `demo-n-${String(noveltySequence).padStart(4, "0")}`,
            visitId: visit.id,
            priority: catalogEntry.priority,
            status: noveltyStatus,
            description: catalogEntry.description,
            lat: geo.lat,
            lng: geo.lng,
            ...resolved,
            clientCreatedAt: noveltyAt,
            receivedAt: new Date(noveltyAt.getTime() + syncLatencyMs()),
          },
        });

        stats.noveltiesByStatus[noveltyStatus] += 1;

        // Las de mayor prioridad casi siempre llegan con foto: es lo que el
        // coordinador revisa primero en RF-PAN-05.
        const wantsPhoto =
          catalogEntry.priority === "CRITICAL" ||
          catalogEntry.priority === "HIGH" ||
          chance(0.3);

        if (wantsPhoto) {
          const shots = catalogEntry.priority === "CRITICAL" ? 2 : 1;

          for (let index = 0; index < shots; index += 1) {
            pushEvidence({
              ownerType: "NOVELTY",
              ownerId: novelty.id,
              url: `/uploads/demo/novedad-${noveltySequence}-${index + 1}.jpg`,
              clientCreatedAt: new Date(noveltyAt.getTime() + randInt(10, 180) * 1000),
              capturedById: supervisor.id,
            });
          }
        }
      }
    }
  }

  // Las evidencias se meten todas de una vez: no dependen de nada mas.
  for (let start = 0; start < createdEvidence.length; start += 200) {
    await prisma.evidence.createMany({ data: createdEvidence.slice(start, start + 200) });
  }

  await report(stats);
}

/** Volca el resumen de lo sembrado. */
async function report(stats: {
  visitsByStatus: Record<string, number>;
  outOfRangeVisits: number;
  withoutGps: number;
  verifiedScans: number;
  rejectedScans: number;
  noveltiesByStatus: Record<string, number>;
  evidenceByOwner: Record<string, number>;
  checklistDone: number;
  checklistNotDone: number;
  checklistPending: number;
}): Promise<void> {
  const counts = {
    supervisores: await prisma.user.count({ where: { role: "SUPERVISOR" } }),
    coordinadores: await prisma.user.count({ where: { role: "COORDINADOR" } }),
    centrosCosto: await prisma.costCenter.count(),
    puntosQr: await prisma.qrPoint.count(),
    qrInactivos: await prisma.qrPoint.count({ where: { isActive: false } }),
    plantillas: await prisma.checklistTemplate.count(),
    itemsPlantilla: await prisma.checklistTemplateItem.count(),
    visitas: await prisma.visit.count(),
    visitasPorEstado: stats.visitsByStatus,
    visitasFueraDeRango: stats.outOfRangeVisits,
    visitasSinGps: stats.withoutGps,
    escaneos: await prisma.qrScan.count(),
    escaneosVerificados: stats.verifiedScans,
    escaneosRechazados: stats.rejectedScans,
    novedades: await prisma.novelty.count(),
    novedadesPorEstado: stats.noveltiesByStatus,
    evidencias: await prisma.evidence.count(),
    evidenciasPorDueno: stats.evidenceByOwner,
    checklistCumplido: stats.checklistDone,
    checklistNoCumplido: stats.checklistNotDone,
    checklistPendiente: stats.checklistPending,
  };

  console.log("Operacion de demostracion sembrada:");
  console.log(JSON.stringify(counts, null, 2));

  const visited = await prisma.visit.count({
    where: { checkInAt: { not: null }, checkInOutOfRange: true },
  });
  const delayed = await prisma.visit.count({
    where: { status: "ASSIGNED", scheduledAt: { lt: new Date() } },
  });

  console.log(`\nAlertas RF-PAN-08: ${visited} visitas con check-in fuera de rango.`);
  console.log(`Visitas demoradas: ${delayed}.`);
  console.log("\nCredenciales: supervisor@demo.test / supervisor123, coordinador@demo.test / coordinador123");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });