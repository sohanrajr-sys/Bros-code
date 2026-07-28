"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword, getDummyPasswordHash } from "@/lib/password";
import { signSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/jwt";
import { studentLoginInputSchema, adminLoginInputSchema } from "@/lib/authSchema";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

export async function studentLogin(formData: FormData) {
  const parsed = studentLoginInputSchema.safeParse({
    studentId: formData.get("studentId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/login?as=student&error=1");
  }

  const ip = await getClientIp();
  const [byIdentifier, byIp] = await Promise.all([
    checkRateLimit(`login:student:id:${parsed.data.studentId}`, { limit: 5, windowSeconds: 900 }),
    checkRateLimit(`login:student:ip:${ip}`, { limit: 20, windowSeconds: 900 }),
  ]);
  if (!byIdentifier.allowed || !byIp.allowed) {
    redirect("/login?as=student&error=ratelimited");
  }

  const user = await prisma.user.findUnique({
    where: { studentId: parsed.data.studentId },
  });

  const passwordOk = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? (await getDummyPasswordHash()),
  );
  if (!user || user.role !== "STUDENT" || !passwordOk) {
    redirect("/login?as=student&error=1");
  }

  const token = await signSession({ sub: user.id, role: user.role, name: user.name, loginId: user.studentId! });
  (await cookies()).set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  redirect("/");
}

export async function adminLogin(formData: FormData) {
  const parsed = adminLoginInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/login?as=admin&error=1");
  }

  const ip = await getClientIp();
  const [byIdentifier, byIp] = await Promise.all([
    checkRateLimit(`login:admin:id:${parsed.data.email}`, { limit: 5, windowSeconds: 900 }),
    checkRateLimit(`login:admin:ip:${ip}`, { limit: 20, windowSeconds: 900 }),
  ]);
  if (!byIdentifier.allowed || !byIp.allowed) {
    redirect("/login?as=admin&error=ratelimited");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  const passwordOk = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? (await getDummyPasswordHash()),
  );
  if (!user || user.role !== "ADMIN" || !passwordOk) {
    redirect("/login?as=admin&error=1");
  }

  const token = await signSession({ sub: user.id, role: user.role, name: user.name, loginId: user.email! });
  (await cookies()).set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  redirect("/admin/problems");
}
