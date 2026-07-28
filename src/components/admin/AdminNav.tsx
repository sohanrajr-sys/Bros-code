"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/problems", label: "Problems" },
  { href: "/admin/quizzes", label: "Quizzes" },
  { href: "/admin/students", label: "Students" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4">
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`text-sm transition-colors ${
              active ? "font-medium text-cyan" : "text-foreground hover:text-cyan"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
