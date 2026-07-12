import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";
import { ProblemForm } from "@/components/admin/ProblemForm";
import type { FunctionSignature } from "@/lib/functionSignature";

export const dynamic = "force-dynamic";

export default async function EditProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUserFromCookies();

  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  const { id } = await params;
  const problem = await prisma.problem.findUnique({
    where: { id },
    include: { testCases: { orderBy: { order: "asc" } } },
  });

  if (!problem) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold text-danger">Problem not found</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">Edit problem</h1>
      <div className="mt-6">
        <ProblemForm
          mode="edit"
          problemId={problem.id}
          initial={{
            slug: problem.slug,
            title: problem.title,
            description: problem.description,
            difficulty: problem.difficulty,
            type: problem.type,
            constraints: problem.constraints ?? "",
            tags: problem.tags,
            functionSignature: problem.functionSignature as FunctionSignature | null,
            testCases: problem.testCases.map((tc) => ({
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isHidden: tc.isHidden,
              order: tc.order,
            })),
          }}
        />
      </div>
    </main>
  );
}
