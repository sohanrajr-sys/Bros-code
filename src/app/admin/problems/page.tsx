import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { Forbidden } from "@/components/admin/Forbidden";

export const dynamic = "force-dynamic";

async function getProblems() {
  return prisma.problem.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      type: true,
      tags: true,
      _count: { select: { testCases: true } },
    },
  });
}

async function deleteProblem(formData: FormData) {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") return;

  await prisma.problem.delete({ where: { id } });
  revalidatePath("/admin/problems");
}

export default async function AdminProblemsPage() {
  const user = await getSessionUserFromCookies();

  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  const problems = await getProblems();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Admin: Problems</h1>
          <p className="mt-1 text-sm text-text-muted">
            {problems.length} problem{problems.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/problems/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded bg-cyan/15 px-4 text-sm font-medium text-cyan hover:bg-cyan/25"
        >
          New problem
        </Link>
      </div>

      {problems.length === 0 ? (
        <p className="mt-8 text-text-muted">No problems yet. Create one to get started.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {problems.map((problem) => (
            <li
              key={problem.id}
              className="rounded-lg border border-navy-border bg-navy-900 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{problem.title}</span>
                    <DifficultyBadge difficulty={problem.difficulty} />
                    <span className="rounded bg-navy-800 px-2 py-0.5 text-xs uppercase text-text-muted">
                      {problem.type}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <span>/{problem.slug}</span>
                    <span>&middot;</span>
                    <span>{problem._count.testCases} test case{problem._count.testCases === 1 ? "" : "s"}</span>
                    {problem.tags.map((tag) => (
                      <span key={tag} className="rounded bg-navy-800 px-2 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/admin/problems/${problem.id}/edit`}
                    className="inline-flex min-h-[44px] items-center justify-center rounded border border-navy-border px-3 text-sm text-foreground hover:border-cyan hover:text-cyan"
                  >
                    Edit
                  </Link>
                  <form action={deleteProblem}>
                    <input type="hidden" name="id" value={problem.id} />
                    <button
                      type="submit"
                      className="inline-flex min-h-[44px] items-center justify-center rounded border border-navy-border px-3 text-sm text-danger hover:border-danger"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
