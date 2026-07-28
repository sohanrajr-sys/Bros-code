"use client";

import { useState } from "react";
import { studentLogin, adminLogin } from "./actions";
import { logout } from "@/app/actions/logout";
import type { SessionUser } from "@/lib/session";

type Role = "student" | "admin";

function errorMessage(error: string | undefined, mismatchText: string): string | null {
  if (!error) return null;
  if (error === "ratelimited") return "Too many attempts. Try again in a few minutes.";
  return mismatchText;
}

export function LoginPageClient({
  initialRole,
  error,
  session,
}: {
  initialRole: Role;
  error?: string;
  session: SessionUser | null;
}) {
  const [role, setRole] = useState<Role>(initialRole);
  // The error param belongs to whichever form produced it (initialRole) — if
  // the admin switches tabs client-side without a new submission, don't show
  // a stale error against the wrong form.
  const activeError = role === initialRole ? error : undefined;
  const studentErrorMessage = errorMessage(activeError, "That ID or password doesn't match.");
  const adminErrorMessage = errorMessage(activeError, "That email or password doesn't match.");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-navy-border bg-navy-900 p-6">
        <h1 className="text-lg font-semibold text-foreground">Academic OS</h1>
        <p className="mt-1 text-sm text-text-muted">Sign in to continue</p>

        {session && (
          <div className="mt-4 rounded border border-amber/30 bg-amber/10 p-3">
            <p className="text-sm text-amber">
              {`You're currently logged in as ${session.loginId} (${session.role}).`}
            </p>
            <form action={logout} className="mt-2">
              <button
                type="submit"
                className="rounded border border-navy-border px-3 py-1 text-xs text-foreground transition-colors hover:border-cyan hover:text-cyan"
              >
                Log out to switch accounts
              </button>
            </form>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setRole("student")}
            aria-pressed={role === "student"}
            className={`min-h-[44px] flex-1 rounded border px-3 text-sm font-medium transition-colors ${
              role === "student"
                ? "border-cyan bg-cyan/15 text-cyan"
                : "border-navy-border text-text-muted hover:text-foreground"
            }`}
          >
            Login as Student
          </button>
          <button
            type="button"
            onClick={() => setRole("admin")}
            aria-pressed={role === "admin"}
            className={`min-h-[44px] flex-1 rounded border px-3 text-sm font-medium transition-colors ${
              role === "admin"
                ? "border-cyan bg-cyan/15 text-cyan"
                : "border-navy-border text-text-muted hover:text-foreground"
            }`}
          >
            Login as Admin
          </button>
        </div>

        {role === "student" ? (
          <form action={studentLogin} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="studentId" className="text-sm text-text-muted">
                Student ID
              </label>
              <input
                id="studentId"
                name="studentId"
                type="text"
                autoComplete="username"
                required
                placeholder="2026-CSE-0417"
                className="min-h-[44px] rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground placeholder:text-text-muted/60"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="studentPassword" className="text-sm text-text-muted">
                Password
              </label>
              <input
                id="studentPassword"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="min-h-[44px] rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground"
              />
            </div>

            {studentErrorMessage && <p className="text-sm text-danger">{studentErrorMessage}</p>}

            <button
              type="submit"
              className="min-h-[44px] rounded bg-cyan/15 px-4 text-sm font-medium text-cyan transition-colors hover:bg-cyan/25"
            >
              Sign in
            </button>

            <p className="text-center text-xs text-text-muted">
              Credentials are issued by your course administrator
            </p>
          </form>
        ) : (
          <form action={adminLogin} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm text-text-muted">
                Admin email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="priya@contentops.edu"
                className="min-h-[44px] rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground placeholder:text-text-muted/60"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="adminPassword" className="text-sm text-text-muted">
                Password
              </label>
              <input
                id="adminPassword"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="min-h-[44px] rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground"
              />
            </div>

            {adminErrorMessage && <p className="text-sm text-danger">{adminErrorMessage}</p>}

            <button
              type="submit"
              className="min-h-[44px] rounded bg-foreground px-4 text-sm font-medium text-navy-950 transition-opacity hover:opacity-90"
            >
              Sign in
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
