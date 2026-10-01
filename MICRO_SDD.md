```markdown
# MICRO SDD: Supervisión Inteligente de Servicios en Campo
**Documento Central de Requisitos y Fuente de Verdad Funcional**
*Contexto: Reto Hackathon (Empresa de Servicios de Aseo) | Versión 1.0 (MVP)*

---

## 1. Visión General del Producto y Objetivos

El sistema resuelve el control, trazabilidad, evidencia y toma de decisiones en campo para empresas de aseo mediante dos interfaces principales:
1. **PWA Móvil (Supervisor en campo):** Operación 100% resiliente a pérdida de señal, check-in/out geolocalizado, escaneo de códigos QR por área física, checklist de actividades, registro de novedades con evidencia fotográfica comprimida y cola local de sincronización (Outbox).
2. **Panel Web Desktop (Coordinador en oficina):** Visualización en tiempo casi real ($\le 10$ s vía sondeo), mapas de ubicación, alertas inmediatas de novedades, control del ciclo de vida de incidencias y asignación de visitas.

---

## 2. Mapa de Roles y Asignación de Módulos (Hackathon)

Para evitar colisiones entre integrantes y agentes de IA, cada participante es responsable exclusivo de un subsistema funcional:

| Integrante / Rama | Rol en el Proyecto | Alcance y Módulos del SRS Asignados |
| :--- | :--- | :--- |
| **Juan**<br>`main` | **Contrato de Datos y Arquitectura** | - Definición formal de entidades y atributos.<br>- Consistencia relacional e integridad transaccional.<br>- Reglas de idempotencia (`clientId`) y doble timestamp (`clientCreatedAt`, `receivedAt`).<br>- Empalme e integración de ramas. |
| **Lewis**<br>`lewis/sync-supervisor` | **Backend de Sincronización y Archivos** | - **RF-VIS:** Ingestión de check-in / check-out.<br>- **RF-OFF:** Procesamiento de la cola de sincronización (Outbox) con garantía de idempotencia.<br>- **RF-SUP:** Recepción y almacenamiento de evidencias fotográficas.<br>- Endpoint de diagnóstico de conectividad real (`/api/ping`). |
| **Sebastian**<br>`sebastian/panel-coordinador` | **Backend de Operaciones y Métricas** | - **RF-ASI:** Lógica de asignación y planificación de visitas.<br>- **RF-PAN:** Agregación de KPIs, alertas en tiempo casi real y estados de supervisores.<br>- **RF-NOV:** Flujo de cambio de estados y cierre de novedades.<br>- **RF-QR:** Gestión y emisión de puntos QR imprimibles. |
| **Samuel**<br>`samuel/pwa-ui` | **Frontend PWA y Dashboard Web** | - **RF-AUT:** Vistas de acceso y control visual por rol.<br>- **RF-OFF / PWA:** Almacenamiento local (Dexie), service worker, indicador de pendientes.<br>- **RF-QR:** Lector de QR con cámara y cálculo geográfico local.<br>- **RF-PAN / UI:** Vistas del panel de control, mapa y tablas de gestión. |

---

## 3. Reglas de Negocio Críticas (Inmutables)

1. **Prioridad Offline-First:** El supervisor debe poder completar toda su jornada (check-in, checklist, novedades, fotos, escaneo QR y check-out) con el celular en modo avión.
2. **Idempotencia Transaccional:** Cada registro generado en el cliente lleva un identificador único de origen (`clientId`). El servidor garantiza que recibir la misma operación más de una vez jamás duplique registros.
3. **Autoridad Geográfica:**
   - En el dispositivo se valida localmente la distancia con fórmula de Haversine para dar feedback inmediato al supervisor.
   - Si la distancia supera la tolerancia, **no se bloquea la operación**, sino que se marca con la bandera `fuera de rango` para auditoría.
   - El servidor recalcula la distancia al sincronizar como entidad definitiva de verdad.
4. **Ciclo de Vida de Novedades:**
   $$\text{ABIERTA} \longrightarrow \text{EN\_SEGUIMIENTO} \longrightarrow \text{CERRADA}$$
   El cierre exige registrar usuario responsable, fecha/hora y acción tomada.
5. **Doble Registro Cronológico:** Se preserva intacta la hora local del dispositivo en que ocurrió el hecho (`clientCreatedAt`) diferenciada de la hora de recepción en el servidor (`receivedAt`).

---

## 4. Especificación de Requisitos Funcionales

### 4.1 Autenticación y Roles (RF-AUT)
- **RF-AUT-01:** Inicio de sesión con credenciales (correo y contraseña). *(Alta)*
- **RF-AUT-02:** Restricción de acceso estricta por rol (`SUPERVISOR` y `COORDINADOR`) validada en servidor. *(Alta)*
- **RF-AUT-03:** Redirección automática tras autenticación: supervisor a la vista móvil; coordinador al panel desktop. *(Alta)*
- **RF-AUT-04:** Persistencia de sesión local en el dispositivo para permitir acceso en modo sin conexión. *(Media)*

### 4.2 Asignación y Planificación (RF-ASI)
- **RF-ASI-01:** Creación, edición y cancelación de visitas indicando supervisor, centro de costo, fecha y hora. *(Alta)*
- **RF-ASI-02:** Gestión de centros de costo (nombre, dirección y coordenadas GPS de referencia). *(Alta)*
- **RF-ASI-03:** Asociación de plantillas de checklist por centro de costo o área. *(Media)*
- **RF-ASI-04:** Consulta en la PWA de las visitas programadas para el supervisor durante el día. *(Alta)*

### 4.3 Validación de la Visita (RF-VIS)
- **RF-VIS-01:** Check-in con captura de coordenadas GPS (latitud, longitud, precisión), fecha/hora y supervisor. *(Alta)*
- **RF-VIS-02:** Check-out registrando las mismas variables de auditoría y observaciones de cierre. *(Alta)*
- **RF-VIS-03:** Cálculo de proximidad respecto al centro de costo con categorización automática: *verificado* o *fuera de rango*. *(Alta)*
- **RF-VIS-04:** Bloqueo de check-out si no existe check-in previo; prevención de check-in duplicado para la misma visita. *(Alta)*
- **RF-VIS-05:** Ejecución completa de check-in y check-out en ausencia total de red. *(Alta)*
- **RF-VIS-06:** Soporte para adjuntar evidencia fotográfica de llegada. *(Media)*
- **RF-VIS-07:** Cálculo y visualización de la duración total de la visita. *(Media)*

### 4.4 Puntos de Control y Escaneo QR (RF-QR)
- **RF-QR-01:** Puntos QR asociados a un centro de costo, área física específica, coordenadas y radio de tolerancia (por defecto 50 m). *(Alta)*
- **RF-QR-02:** Activación/desactivación de puntos QR y generación de hoja con códigos para impresión física. *(Alta)*
- **RF-QR-03:** Escáner integrado en la PWA mediante la cámara del móvil funcional sin conexión a internet. *(Alta)*
- **RF-QR-04:** Soporte para apertura vía URL directa (`/q/{codigo}`) desde la cámara nativa del teléfono. *(Media)*
- **RF-QR-05:** Resolución inmediata del código contra datos precargados localmente en el dispositivo. *(Alta)*
- **RF-QR-06:** Mensaje explícito de error en pantalla si el código escaneado no existe o está inactivo. *(Alta)*
- **RF-QR-07:** Cálculo local de distancia mediante Haversine: si $\text{distancia} \le \text{radio}$, marcar como *verificado*. *(Alta)*
- **RF-QR-08:** En caso de estar fuera de rango, permitir continuar la captura pero marcar el evento para revisión. *(Alta)*
- **RF-QR-09:** Redirección post-escaneo al panel del área (checklist específico, fotos, observaciones y novedades). *(Alta)*
- **RF-QR-10:** Registro del evento de escaneo en la cola local de sincronización con datos de auditoría completos. *(Alta)*

### 4.5 Ejecución de Supervisión y Evidencias (RF-SUP)
- **RF-SUP-01:** Consulta y visualización del checklist asignado al centro de costo o área escaneada. *(Alta)*
- **RF-SUP-02:** Marcación de ítems del checklist como *cumplido* o *no cumplido*, con soporte de comentarios. *(Alta)*
- **RF-SUP-03:** Captura de observaciones generales de la visita. *(Alta)*
- **RF-SUP-04:** Captura fotográfica con compresión en el cliente (máximo 1280 px y $\approx 300\text{ KB}$). *(Alta)*
- **RF-SUP-05:** Vinculación polimórfica de evidencias a visitas, tareas, novedades o escaneos QR. *(Alta)*
- **RF-SUP-06:** Encolamiento inmediato tras presionar «Enviar evidencia» mostrando mensaje «Guardado localmente». *(Alta)*
- **RF-SUP-07:** Visualización del estado de sincronización por registro: *pendiente*, *sincronizando*, *sincronizado* o *error*. *(Alta)*

### 4.6 Mecanismo Offline y Sincronización (RF-OFF)
- **RF-OFF-01:** Precarga inicial con conexión de visitas del día, checklists, centros de costo y puntos QR. *(Alta)*
- **RF-OFF-02:** Renderizado y lectura desacoplados de la red apoyados en almacenamiento local. *(Alta)*
- **RF-OFF-03:** Cola de salida (Outbox) local basada en `clientId` único para cada transacción. *(Alta)*
- **RF-OFF-04:** Almacenamiento local de fotografías como Blob/archivo, desacoplado de la cola de metadatos. *(Alta)*
- **RF-OFF-05:** Detección de conectividad real mediante sondeo activo (ping al servidor) descartando falsos positivos. *(Alta)*
- **RF-OFF-06:** Disparo de sincronización multinivel: reconexión, apertura de app, retorno al primer plano, intervalo automático (30 s) y botón manual. *(Alta)*
- **RF-OFF-07:** Envío secuencial: primero transacciones/metadatos cronológicos, luego subida individual de imágenes. *(Alta)*
- **RF-OFF-08:** Procesamiento idempotente en backend (`upsert` por `clientId`) inmune a reintentos o desconexiones parciales. *(Alta)*
- **RF-OFF-09:** Manejo de fallos con preservación de datos, incremento de reintentos y guardado del último mensaje de error. *(Alta)*
- **RF-OFF-10:** Contador visible en la interfaz con el número de operaciones pendientes de sincronizar. *(Alta)*
- **RF-OFF-11:** Disponibilidad del App Shell sin red mediante Service Worker (incluyendo rutas de escaneo y panel). *(Alta)*

### 4.7 Gestión de Novedades (RF-NOV)
- **RF-NOV-01:** Registro de incidencias con descripción, nivel de prioridad (alta, media, baja), coordenadas y foto soporte. *(Alta)*
- **RF-NOV-02:** Estados de novedad: *abierta*, *en seguimiento* y *cerrada*. *(Alta)*
- **RF-NOV-03:** Emisión de alerta prioritaria e inmediata en el panel del coordinador tras sincronizarse una novedad. *(Alta)*
- **RF-NOV-04:** Módulo de seguimiento para el coordinador: revisión de evidencias, cambio de estado y registro de medidas tomadas. *(Alta)*
- **RF-NOV-05:** Auditoría de cierre con fecha/hora y usuario responsable. *(Media)*
- **RF-NOV-06:** Filtros de novedades por prioridad, estado, centro de costo, supervisor y rango de fechas. *(Media)*

### 4.8 Panel del Coordinador (RF-PAN)
- **RF-PAN-01:** Métricas clave (KPIs): total de visitas programadas, realizadas, pendientes y novedades abiertas. *(Alta)*
- **RF-PAN-02:** Mapa geográfico interactivo con centros de costo, última posición conocida de supervisores y puntos QR escaneados. *(Alta)*
- **RF-PAN-03:** Listado operativo de supervisores activos con el estado en curso de sus rutas. *(Alta)*
- **RF-PAN-04:** Actualización automática del panel (sondeo cada 5 a 10 segundos) sin recarga manual de página. *(Alta)*
- **RF-PAN-05:** Galería de evidencias fotográficas vinculadas a visitas, escaneos y novedades. *(Alta)*
- **RF-PAN-06:** Historial detallado de visitas con filtros multicriterio. *(Media)*
- **RF-PAN-07:** Indicadores de cumplimiento porcentual (% visitas hechas, % tareas completadas, % validaciones GPS exitosas). *(Media)*
- **RF-PAN-08:** Alertas visuales ante visitas demoradas o check-ins realizados fuera de rango. *(Media)*

### 4.9 Reportes (RF-REP)
- **RF-REP-01:** Consolidación de reportes de visitas, novedades y cumplimiento por supervisor o centro de costo. *(Media)*
- **RF-REP-02:** Filtros por periodo temporal configurable. *(Media)*
- **RF-REP-03:** Exportación en formatos estándar (PDF y Excel). *(Media)*

---

## 5. Requisitos No Funcionales (RNF)

| ID | Categoría | Especificación |
| :--- | :--- | :--- |
| **RNF-01** | **Rendimiento Offline** | Las acciones del supervisor en modo avión (guardar respuestas, escanear QR, encolar fotos) deben responder en menos de 1 segundo. |
| **RNF-02** | **Tiempo de Carga** | Tras la primera instalación/visita, la PWA debe iniciar en menos de 3 segundos mediante App Shell en caché. |
| **RNF-03** | **Latencia del Panel** | Nuevos eventos sincronizados deben reflejarse en la pantalla del coordinador en un máximo de 10 segundos. |
| **RNF-04** | **Optimización Multimedia** | Cada fotografía capturada debe comprimirse a un peso aproximado menor o igual a 300 KB antes de su transmisión. |
| **RNF-05** | **Disponibilidad** | El ciclo completo de campo (check-in, escaneo, checklist, novedades, fotos y check-out) debe operar sin conectividad. |
| **RNF-06** | **Integridad** | Cero pérdida y cero duplicidad de registros ante caídas abruptas de red, cierres forzados de la app o reintentos múltiples. |
| **RNF-07** | **Seguridad** | Claves protegidas mediante algoritmos de hash seguro. Tráfico cifrado mediante HTTPS para habilitar cámara y GPS. |
| **RNF-08** | **Autorización** | Validación de roles (`SUPERVISOR` vs `COORDINADOR`) obligatoria en el lado servidor para cada operación. |
| **RNF-09** | **Seguridad en QR** | Los códigos QR contienen únicamente un identificador opaco único; las coordenadas y detalles del área se resuelven en el sistema. |
| **RNF-10** | **Privacidad** | Captura de coordenadas GPS restringida exclusivamente al momento en que el usuario ejecuta una acción deliberada de supervisión. |
| **RNF-11** | **Usabilidad Móvil** | Interfaz mobile-first utilizable con una sola mano, objetivos táctiles mínimos de 44 px y alto contraste para visibilidad en exteriores. |
| **RNF-12** | **Transparencia de Estado** | Indicadores claros y permanentes del estado de conexión (en línea / fuera de línea) y cantidad de elementos pendientes de subida. |
| **RNF-13** | **Portabilidad** | Despliegue de entorno de base de datos y servicios auxiliares reproducible con Docker Compose en un solo comando. |
| **RNF-14** | **Trazabilidad** | Todo registro debe conservar autor, hora local original del dispositivo y hora exacta de sincronización en servidor. |

---

## 6. Criterios de Aceptación del MVP (Demostración Hackathon)

- **CA-01 (Prueba de Modo Avión):** Con el móvil desconectado de red, el supervisor hace check-in, escanea un QR físico precargado y la aplicación valida la distancia mostrando «Verificado» o «Fuera de rango».
- **CA-02 (Trabajo de Campo Offline):** Sin conexión, el supervisor diligencia el checklist, toma fotografías y reporta una novedad con foto; el contador de pendientes aumenta visiblemente.
- **CA-03 (Sincronización Idempotente):** Al desactivar el modo avión, la cola se transmite automáticamente sin duplicar registros, incluso si se fuerza la recarga a mitad del proceso.
- **CA-04 (Alerta en Panel):** La novedad registrada en campo aparece como notificación en el dashboard del coordinador en menos de 10 segundos tras la sincronización.
- **CA-05 (Auditoría Temporal):** El dashboard muestra la hora real en que el supervisor tomó la foto en campo, no la hora posterior en que recuperó la señal.
- **CA-06 (Control de Acceso):** Un supervisor no puede visualizar pantallas de gestión ni el panel de control del coordinador.
- **CA-07 (Cierre de Novedad):** El coordinador puede cambiar el estado de la incidencia hasta darla por cerrada registrando la acción correctiva.
```

