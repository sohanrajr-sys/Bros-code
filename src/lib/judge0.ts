import { Language } from "@/generated/prisma/enums";

// Judge0's standard language IDs (self-hosted judge0/judge0:1.13.0), confirmed
// against the /languages endpoint of a stock instance. SQL has no entry here —
// SQL submissions never reach Judge0, they're graded directly against Postgres.
export const JUDGE0_LANGUAGE_IDS: Partial<Record<Language, number>> = {
  [Language.C]: 50,
  [Language.CPP]: 54,
  [Language.JAVA]: 62,
  [Language.PYTHON]: 71,
  [Language.GO]: 60,
  [Language.SCALA]: 81,
};

// Judge0 status.id 3 == "Accepted". Everything else (wrong answer, compile
// error, runtime error, time/memory limit exceeded, ...) counts as a failure.
const JUDGE0_ACCEPTED_STATUS_ID = 3;

export interface Judge0Status {
  id: number;
  description: string;
}

export interface Judge0SubmissionResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: Judge0Status;
}

export function isJudge0Accepted(result: Judge0SubmissionResult): boolean {
  return result.status.id === JUDGE0_ACCEPTED_STATUS_ID;
}

export async function runJudge0Submission(params: {
  sourceCode: string;
  languageId: number;
  stdin: string;
  expectedOutput: string;
}): Promise<Judge0SubmissionResult> {
  const baseUrl = process.env.JUDGE0_URL ?? "http://localhost:2358";

  const response = await fetch(`${baseUrl}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_code: params.sourceCode,
      language_id: params.languageId,
      stdin: params.stdin,
      expected_output: params.expectedOutput,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`judge0 request failed: ${response.status} ${body}`);
  }

  return (await response.json()) as Judge0SubmissionResult;
}
