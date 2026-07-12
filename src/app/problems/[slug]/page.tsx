import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { SolveWorkspace } from "@/components/solve/SolveWorkspace";
import { getCodegen } from "@/lib/codegen";
import { functionSignatureSchema } from "@/lib/functionSignature";
import { DSA_LANGUAGES, STARTER_CODE } from "@/components/solve/languageMeta";
import type { Language } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

async function getProblem(slug: string) {
  return prisma.problem.findUnique({
    where: { slug },
    include: {
      testCases: {
        where: { isHidden: false },
        orderBy: { order: "asc" },
      },
    },
  });
}

export default async function SolvePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const problem = await getProblem(slug);
  if (!problem) notFound();

  const starterCodeByLanguage: Partial<Record<Language, string>> = {};
  if (problem.type === "DSA" && problem.functionSignature) {
    const sig = functionSignatureSchema.parse(problem.functionSignature);
    for (const lang of DSA_LANGUAGES) {
      const codegen = getCodegen(lang);
      starterCodeByLanguage[lang] = codegen ? codegen.starterTemplate(sig) : STARTER_CODE[lang];
    }
  } else {
    for (const lang of DSA_LANGUAGES) starterCodeByLanguage[lang] = STARTER_CODE[lang];
  }
  starterCodeByLanguage.SQL = STARTER_CODE.SQL;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-navy-border px-4 py-3">
        <h1 className="text-lg font-semibold text-foreground">{problem.title}</h1>
        <DifficultyBadge difficulty={problem.difficulty} />
        <span className="text-xs uppercase text-text-muted">{problem.type}</span>
        <div className="flex flex-wrap gap-1">
          {problem.tags.map((tag) => (
            <span key={tag} className="rounded bg-navy-800 px-2 py-0.5 text-xs text-text-muted">
              {tag}
            </span>
          ))}
        </div>
      </header>

      <SolveWorkspace
        problemId={problem.id}
        problemType={problem.type}
        description={problem.description}
        constraints={problem.constraints}
        sampleTestCases={problem.testCases}
        starterCodeByLanguage={starterCodeByLanguage}
      />
    </main>
  );
}
