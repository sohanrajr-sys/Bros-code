import { Language } from "@/generated/prisma/enums";

// Piston (self-hosted engineer-man/piston) runtime versions installed on this
// host — see docker-compose.yml's piston_api service. SQL has no entry here —
// SQL submissions never reach Piston, they're graded directly against Postgres.
export const PISTON_RUNTIMES: Partial<Record<Language, { language: string; version: string; filename: string }>> = {
  [Language.C]: { language: "c", version: "10.2.0", filename: "main.c" },
  [Language.CPP]: { language: "c++", version: "10.2.0", filename: "main.cpp" },
  [Language.JAVA]: { language: "java", version: "15.0.2", filename: "Main.java" },
  [Language.PYTHON]: { language: "python", version: "3.12.0", filename: "main.py" },
  [Language.GO]: { language: "go", version: "1.16.2", filename: "main.go" },
};

export interface PistonRunResult {
  stdout: string;
  stderr: string;
  compileStderr: string;
  compileFailed: boolean;
  timedOut: boolean;
}

export async function runPistonSubmission(params: {
  sourceCode: string;
  language: Language;
  stdin: string;
}): Promise<PistonRunResult> {
  const runtime = PISTON_RUNTIMES[params.language];
  if (!runtime) {
    throw new Error(`no piston runtime mapping for language "${params.language}"`);
  }

  const baseUrl = process.env.PISTON_URL ?? "http://localhost:2000";

  const response = await fetch(`${baseUrl}/api/v2/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: runtime.language,
      version: runtime.version,
      files: [{ name: runtime.filename, content: params.sourceCode }],
      stdin: params.stdin,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`piston request failed: ${response.status} ${body}`);
  }

  const json = await response.json();
  const compileFailed = json.compile != null && json.compile.code !== 0;
  const timedOut = json.compile?.signal === "SIGKILL" || json.run?.signal === "SIGKILL";

  return {
    stdout: json.run?.stdout ?? "",
    stderr: json.run?.stderr ?? "",
    compileStderr: json.compile?.stderr ?? "",
    compileFailed,
    timedOut,
  };
}
