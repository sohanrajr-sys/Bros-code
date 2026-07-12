import type { TestCase } from "@/generated/prisma/client";
import type { Language } from "@/generated/prisma/enums";
import { isJudge0Accepted, JUDGE0_LANGUAGE_IDS, runJudge0Submission } from "@/lib/judge0";
import type { FirstFailure, GradeOutcome, TestCaseResult } from "../types";

export async function gradeDsa(
  language: Language,
  code: string,
  testCases: TestCase[]
): Promise<GradeOutcome> {
  const languageId = JUDGE0_LANGUAGE_IDS[language];
  if (!languageId) {
    throw new Error(`no judge0 language mapping for language "${language}"`);
  }

  const cases: TestCaseResult[] = [];
  let firstFailure: FirstFailure | undefined;

  for (const testCase of testCases) {
    const result = await runJudge0Submission({
      sourceCode: code,
      languageId,
      stdin: testCase.input,
      expectedOutput: testCase.expectedOutput,
    });

    const passed = isJudge0Accepted(result);
    cases.push({ testCaseId: testCase.id, passed, isHidden: testCase.isHidden });

    if (!passed && !firstFailure) {
      firstFailure = {
        testCaseId: testCase.id,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: result.stdout ?? result.compile_output ?? result.stderr ?? result.message ?? "",
        error: result.status.description,
      };
    }
  }

  return {
    passed: cases.every((c) => c.passed),
    results: { cases, firstFailure },
  };
}
