import type { Language } from "@/generated/prisma/enums";
import { PISTON_RUNTIMES, runPistonSubmission } from "@/lib/piston";
import { getCodegen } from "@/lib/codegen";
import { functionSignatureSchema, type FunctionSignature } from "@/lib/functionSignature";
import type { FirstFailure, GradeOutcome, TestCaseResult } from "../types";

/** Structural shape both Problem.TestCase and QuizCodingTestCase satisfy. */
export interface GradableTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export async function gradeDsa(
  language: Language,
  code: string,
  testCases: GradableTestCase[],
  functionSignature?: unknown
): Promise<GradeOutcome> {
  if (!PISTON_RUNTIMES[language]) {
    throw new Error(`no piston runtime mapping for language "${language}"`);
  }

  // A functionSignature means the student only wrote a function stub (see
  // src/lib/codegen) — wrap it with the generated driver before sending to
  // Piston. Problems without a signature fall back to raw stdin/stdout code
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
    const result = await runPistonSubmission({
      sourceCode,
      language,
      stdin: testCase.input,
    });

    const actualOutput = result.stdout.trim();
    const passed = !result.compileFailed && !result.timedOut && actualOutput === testCase.expectedOutput.trim();
    cases.push({ testCaseId: testCase.id, passed, isHidden: testCase.isHidden });

    if (!passed && !firstFailure) {
      const error = result.compileFailed
        ? "Compile Error"
        : result.timedOut
          ? "Time Limit Exceeded"
          : result.stderr
            ? "Runtime Error"
            : "Wrong Answer";
      firstFailure = {
        testCaseId: testCase.id,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: actualOutput || result.compileStderr || result.stderr,
        error,
      };
    }
  }

  return {
    passed: cases.every((c) => c.passed),
    results: { cases, firstFailure },
  };
}
