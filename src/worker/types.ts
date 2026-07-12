export interface TestCaseResult {
  testCaseId: string;
  passed: boolean;
  isHidden: boolean;
}

export interface FirstFailure {
  testCaseId: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error?: string;
}

export interface GradeOutcome {
  passed: boolean;
  results: {
    cases: TestCaseResult[];
    firstFailure?: FirstFailure;
  };
}
