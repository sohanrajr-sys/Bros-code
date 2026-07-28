"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/jwt";
import { getSessionUserFromCookies } from "@/lib/session";

export async function logout() {
  const user = await getSessionUserFromCookies();
  (await cookies()).delete(SESSION_COOKIE_NAME);
  redirect(user?.role === "admin" ? "/login?as=admin" : "/login");
}
