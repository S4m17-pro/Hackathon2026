"use server";

import { cookies } from "next/headers";

import { SESSION_COOKIE, type SessionUser } from "@/app/(auth)/session";
import { prisma } from "@/shared/lib/prisma";
import { verifyPassword } from "@/shared/lib/password";
import type { Role } from "@/shared/types";

export interface SignInResult {
  ok: boolean;
  role?: Role;
  error?: string;
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Correo o contraseña incorrectos." };
  }

  const session: SessionUser = {
    id: user.id,
    name: user.name,
    role: user.role,
  };

  const jar = await cookies();
  jar.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return { ok: true, role: user.role };
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
