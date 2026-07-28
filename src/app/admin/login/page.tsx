import { redirect } from "next/navigation";

// The admin and student login forms now live together at /login (toggle
// buttons pick the role) — this route stays only so old bookmarks/links to
// /admin/login still land somewhere useful.
export default async function AdminLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  redirect(`/login?as=admin${error ? `&error=${error}` : ""}`);
}
