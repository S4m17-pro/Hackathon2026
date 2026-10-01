import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Role } from "@/shared/types";

export const SESSION_COOKIE = "supervision_session";

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (!parsed.id || !parsed.name || (parsed.role !== "SUPERVISOR" && parsed.role !== "COORDINADOR")) {
      return null;
    }

    return { id: parsed.id, name: parsed.name, role: parsed.role };
  } catch {
    return null;
  }
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const session = await getSession();

  if (!session || session.role !== role) {
    redirect("/login");
  }

  return session;
}
