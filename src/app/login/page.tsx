import type { Metadata } from "next";
import { getSessionUserFromCookies } from "@/lib/session";
import { LoginPageClient } from "./LoginPageClient";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; error?: string }>;
}) {
  const { as, error } = await searchParams;
  const session = await getSessionUserFromCookies();
  const initialRole = as === "admin" ? "admin" : "student";

  return <LoginPageClient initialRole={initialRole} error={error} session={session} />;
}
