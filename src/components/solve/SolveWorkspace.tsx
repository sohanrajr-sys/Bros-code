"use client";

import { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import type { Language, ProblemType } from "@/generated/prisma/enums";
import { DSA_LANGUAGES, LANGUAGE_LABELS, MONACO_LANGUAGE_IDS } from "./languageMeta";

interface SampleTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  order: number;
}

interface TestCaseResult {
  testCaseId: string;
  passed: boolean;
  isHidden: boolean;
}

interface FirstFailure {
  testCaseId: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error?: string;
}

interface GradeResult {
  passed: boolean;
  results: { cases: TestCaseResult[]; firstFailure?: FirstFailure };
}

type Tab = "description" | "code" | "results";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// The server can fail before producing a JSON body (e.g. an unhandled
// exception yields an empty response) — res.json() throws a confusing
// "Unexpected end of JSON input" in that case, so parse defensively.
async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return { error: `Request failed with status ${res.status}` };
  try {
    return JSON.parse(text);
  } catch {
    return { error: `Unexpected response (status ${res.status})` };
  }
}

export function SolveWorkspace({
  problemId,
  problemType,
  description,
  constraints,
  sampleTestCases,
  starterCodeByLanguage,
}: {
  problemId: string;
  problemType: ProblemType;
  description: string;
  constraints: string | null;
  sampleTestCases: SampleTestCase[];
  starterCodeByLanguage: Partial<Record<Language, string>>;
}) {
  const availableLanguages: Language[] = useMemo(
    () => (problemType === "SQL" ? ["SQL"] : DSA_LANGUAGES),
    [problemType]
  );

  const [language, setLanguage] = useState<Language>(availableLanguages[0]);
  const [codeByLanguage, setCodeByLanguage] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const lang of availableLanguages) initial[lang] = starterCodeByLanguage[lang] ?? "";
    return initial;
  });
  const [activeTab, setActiveTab] = useState<Tab>("description");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<GradeResult | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<GradeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const code = codeByLanguage[language] ?? "";

  function setCode(value: string | undefined) {
    setCodeByLanguage((prev) => ({ ...prev, [language]: value ?? "" }));
  }

  async function handleRun() {
    setRunning(true);
    setErrorMessage(null);
    setRunResult(null);
    setActiveTab("results");
    try {
      const res = await fetch(`/api/problems/${problemId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) ?? "run failed");
      setRunResult(data as unknown as GradeResult);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setErrorMessage(null);
    setSubmissionResult(null);
    setSubmissionStatus("QUEUED");
    setActiveTab("results");
    try {
      const userId = readCookie("debug-user-id") ?? "dev-student";
      const res = await fetch(`/api/problems/${problemId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, language, code }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) ?? "submit failed");

      const submissionId = data.submissionId as string;
      const source = new EventSource(`/api/submissions/${submissionId}/stream`);

      source.addEventListener("status", (event) => {
        const submission = JSON.parse((event as MessageEvent).data);
        setSubmissionStatus(submission.status);
        if (submission.results) {
          setSubmissionResult({
            passed: submission.status === "PASSED",
            results: submission.results,
          });
        }
        if (["PASSED", "FAILED", "ERROR"].includes(submission.status)) {
          setSubmitting(false);
          source.close();
        }
      });

      source.addEventListener("error", () => {
        setSubmitting(false);
        source.close();
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      {/* Mobile tab bar */}
      <div className="flex border-b border-navy-border md:hidden">
        {(["description", "code", "results"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`min-h-[44px] flex-1 px-3 py-2 text-sm capitalize ${
              activeTab === tab
                ? "border-b-2 border-cyan text-cyan"
                : "text-text-muted"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Description panel */}
      <div
        className={`${
          activeTab === "description" ? "block" : "hidden"
        } border-navy-border p-4 md:block md:w-1/2 md:border-r md:p-6`}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">
          {description}
          {constraints && (
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-foreground">Constraints</h2>
              <p className="mt-1 text-text-muted">{constraints}</p>
            </div>
          )}
          {sampleTestCases.length > 0 && (
            <div className="mt-2 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                Sample Test Cases
              </h2>
              {sampleTestCases.map((tc, i) => (
                <div
                  key={tc.id}
                  className="rounded-lg border border-navy-border bg-navy-900 p-3 text-xs"
                >
                  <div className="mb-1 text-text-muted">Example {i + 1}</div>
                  <div>
                    <span className="text-text-muted">Input: </span>
                    <code className="text-cyan">{tc.input}</code>
                  </div>
                  <div>
                    <span className="text-text-muted">Output: </span>
                    <code className="text-mint">{tc.expectedOutput}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Code + results column */}
      <div
        className={`${
          activeTab === "code" || activeTab === "results" ? "flex" : "hidden"
        } flex-col md:flex md:w-1/2`}
      >
        {/* Editor */}
        <div
          className={`${
            activeTab === "code" ? "flex" : "hidden"
          } flex-col md:flex`}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-navy-border bg-navy-900 p-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              disabled={availableLanguages.length === 1}
              className="min-h-[44px] rounded border border-navy-border bg-navy-950 px-2 text-sm text-foreground"
            >
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang]}
                </option>
              ))}
            </select>
            <div className="ml-auto flex gap-2">
              <button
                onClick={handleRun}
                disabled={running || submitting}
                className="min-h-[44px] rounded bg-navy-800 px-4 text-sm font-medium text-cyan disabled:opacity-50"
              >
                {running ? "Running..." : "Run"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={running || submitting}
                className="min-h-[44px] rounded bg-mint px-4 text-sm font-medium text-navy-950 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
          <div className="h-[420px] sm:h-[500px]">
            <Editor
              height="100%"
              language={MONACO_LANGUAGE_IDS[language]}
              theme="vs-dark"
              value={code}
              onChange={setCode}
              options={{ minimap: { enabled: false }, fontSize: 13 }}
            />
          </div>
        </div>

        {/* Results */}
        <div
          className={`${
            activeTab === "results" ? "block" : "hidden"
          } max-h-64 min-h-0 overflow-y-auto border-t border-navy-border bg-navy-900 p-4 text-sm md:block`}
        >
          {errorMessage && <p className="text-danger">{errorMessage}</p>}

          {!errorMessage && !runResult && !submissionStatus && (
            <p className="text-text-muted">
              Run against sample tests or submit for full grading.
            </p>
          )}

          {submissionStatus && !["PASSED", "FAILED", "ERROR"].includes(submissionStatus) && (
            <p className="text-amber">Submission {submissionStatus.toLowerCase()}...</p>
          )}

          {(runResult || (submissionResult && submissionStatus)) && (
            <ResultDetail
              label={submissionStatus ? "Submission" : "Run"}
              result={submissionResult && submissionStatus ? submissionResult : runResult!}
            />
          )}

          {submissionStatus === "ERROR" && (
            <p className="text-danger">
              An unexpected error occurred while grading your submission.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultDetail({ label, result }: { label: string; result: GradeResult }) {
  const { cases, firstFailure } = result.results;
  return (
    <div>
      <p className={result.passed ? "font-semibold text-mint" : "font-semibold text-danger"}>
        {label}: {result.passed ? "Passed" : "Failed"} ({cases.filter((c) => c.passed).length}/
        {cases.length} test cases)
      </p>
      {!result.passed && firstFailure && (
        <div className="mt-2 rounded border border-navy-border bg-navy-950 p-3 text-xs">
          <div className="mb-1 text-text-muted">First failing test case</div>
          <div>
            <span className="text-text-muted">Input: </span>
            <code>{firstFailure.input}</code>
          </div>
          <div>
            <span className="text-text-muted">Expected: </span>
            <code className="text-mint">{firstFailure.expectedOutput}</code>
          </div>
          <div>
            <span className="text-text-muted">Actual: </span>
            <code className="text-danger">{firstFailure.actualOutput}</code>
          </div>
        </div>
      )}
    </div>
  );
}
