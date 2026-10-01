import { bogotaToday, listVisits } from "@/features/coordinacion/queries";

/** Visita de hoy del supervisor: la que está en curso, o si no, la asignada. */
export async function findTodayVisitClientId(supervisorId: string): Promise<string | null> {
  try {
    const day = bogotaToday();
    const visits = await listVisits({
      supervisorId,
      from: `${day}T00:00:00.000-05:00`,
      to: `${day}T23:59:59.999-05:00`,
    });

    const current =
      visits.find((visit) => visit.status === "IN_PROGRESS") ??
      visits.find((visit) => visit.status === "ASSIGNED");

    return current?.clientId ?? null;
  } catch {
    return null;
  }
}
