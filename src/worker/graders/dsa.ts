import type { TestCase } from "@/generated/prisma/client";
import type { Language } from "@/generated/prisma/enums";
import { isJudge0Accepted, JUDGE0_LANGUAGE_IDS, runJudge0Submission } from "@/lib/judge0";
import { getCodegen } from "@/lib/codegen";
import { functionSignatureSchema, type FunctionSignature } from "@/lib/functionSignature";
import type { FirstFailure, GradeOutcome, TestCaseResult } from "../types";

export async function gradeDsa(
  language: Language,
  code: string,
  testCases: TestCase[],
  functionSignature?: unknown
): Promise<GradeOutcome> {
  const languageId = JUDGE0_LANGUAGE_IDS[language];
  if (!languageId) {
    throw new Error(`no judge0 language mapping for language "${language}"`);
  }

  // A functionSignature means the student only wrote a function stub (see
  // src/lib/codegen) — wrap it with the generated driver before sending to
  // Judge0. Problems without a signature fall back to raw stdin/stdout code
  // (the original, pre-codegen model), so this stays backward compatible.
  let sourceCode = code;
  if (functionSignature) {
    const sig: FunctionSignature = functionSignatureSchema.parse(functionSignature);
    const codegen = getCodegen(language);
    if (!codegen) {
      throw new Error(`no codegen module for language "${language}"`);
    }
    sourceCode = codegen.wrapForExecution(sig, code);
  }

  const cases: TestCaseResult[] = [];
  let firstFailure: FirstFailure | undefined;

  for (const testCase of testCases) {
    const result = await runJudge0Submission({
      sourceCode,
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
