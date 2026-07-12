import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DifficultyBadge } from "@/components/DifficultyBadge";

export const dynamic = "force-dynamic";

async function getProblems() {
  return prisma.problem.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      tags: true,
      type: true,
    },
  });
}

export default async function ProblemListPage() {
  const problems = await getProblems();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">Problems</h1>
      <p className="mt-1 text-sm text-text-muted">
        {problems.length} problem{problems.length === 1 ? "" : "s"}
      </p>

      {problems.length === 0 ? (
        <p className="mt-8 text-text-muted">
          No problems yet. Check back soon.
        </p>
      ) : (
        <>
          {/* Desktop / tablet: table layout */}
          <table className="mt-6 hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="border-b border-navy-border text-left text-text-muted">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Difficulty</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => (
                <tr
                  key={problem.id}
                  className="border-b border-navy-border/60 hover:bg-navy-900"
                >
                  <td className="py-3 pr-4">
                    <Link
                      href={`/problems/${problem.slug}`}
                      className="text-foreground hover:text-cyan"
                    >
                      {problem.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <DifficultyBadge difficulty={problem.difficulty} />
                  </td>
                  <td className="py-3 pr-4 text-text-muted uppercase text-xs">
                    {problem.type}
                  </td>
                  <td className="py-3 text-text-muted">
                    {problem.tags.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: stacked cards */}
          <ul className="mt-6 flex flex-col gap-3 md:hidden">
            {problems.map((problem) => (
              <li key={problem.id}>
                <Link
                  href={`/problems/${problem.slug}`}
                  className="block rounded-lg border border-navy-border bg-navy-900 p-4 active:bg-navy-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {problem.title}
                    </span>
                    <DifficultyBadge difficulty={problem.difficulty} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <span className="uppercase">{problem.type}</span>
                    {problem.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-navy-800 px-2 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
