"use client";

export interface TestCaseDraft {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  order: number;
}

export const EMPTY_TEST_CASE: TestCaseDraft = {
  input: "",
  expectedOutput: "",
  isHidden: false,
  order: 0,
};

export function TestCaseListEditor({
  testCases,
  onChange,
}: {
  testCases: TestCaseDraft[];
  onChange: (next: TestCaseDraft[]) => void;
}) {
  function updateTestCase(index: number, patch: Partial<TestCaseDraft>) {
    onChange(testCases.map((tc, i) => (i === index ? { ...tc, ...patch } : tc)));
  }

  function addTestCase() {
    onChange([...testCases, { ...EMPTY_TEST_CASE, order: testCases.length }]);
  }

  function removeTestCase(index: number) {
    onChange(testCases.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Test cases</h2>
        <button
          type="button"
          onClick={addTestCase}
          className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan"
        >
          Add test case
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {testCases.map((tc, index) => (
          <div key={index} className="rounded-lg border border-navy-border bg-navy-900 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-text-muted">Test case {index + 1}</span>
              {testCases.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTestCase(index)}
                  className="min-h-[44px] rounded px-3 text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Input</span>
                <textarea
                  required
                  rows={4}
                  value={tc.input}
                  onChange={(e) => updateTestCase(index, { input: e.target.value })}
                  className="w-full rounded border border-navy-border bg-navy-950 px-3 py-2 font-mono text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Expected output</span>
                <textarea
                  required
                  rows={4}
                  value={tc.expectedOutput}
                  onChange={(e) => updateTestCase(index, { expectedOutput: e.target.value })}
                  className="w-full rounded border border-navy-border bg-navy-950 px-3 py-2 font-mono text-sm text-foreground"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={tc.isHidden}
                  onChange={(e) => updateTestCase(index, { isHidden: e.target.checked })}
                  className="h-5 w-5"
                />
                Hidden test case
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-muted">
                Order
                <input
                  type="number"
                  value={tc.order}
                  onChange={(e) => updateTestCase(index, { order: Number(e.target.value) })}
                  className="min-h-[44px] w-20 rounded border border-navy-border bg-navy-950 px-2 text-foreground"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
