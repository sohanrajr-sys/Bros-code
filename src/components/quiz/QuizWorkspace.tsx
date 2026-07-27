"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";
import { DSA_LANGUAGES, LANGUAGE_LABELS, MONACO_LANGUAGE_IDS, STARTER_CODE } from "@/components/solve/languageMeta";
import { renderInlineCode } from "@/lib/inlineCode";
import type { Language } from "@/generated/prisma/enums";

interface McqOption {
  id: string;
  text: string;
}

interface AttemptQuestion {
  id: string;
  type: "MCQ" | "DESCRIPTIVE" | "CODING";
  prompt: string | null;
  mcqOptions: McqOption[];
  codingQuestion: { description: string; constraints: string | null } | null;
  starterCodeByLanguage: Partial<Record<Language, string>> | null;
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

interface RunResult {
  passed: boolean;
  results: { cases: TestCaseResult[]; firstFailure?: FirstFailure };
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

export function QuizWorkspace({
  attemptId,
  quizTitle,
  timeLimitMinutes,
  startedAt,
  questions,
}: {
  attemptId: string;
  quizTitle: string;
  timeLimitMinutes: number | null;
  startedAt: string;
  questions: AttemptQuestion[];
}) {
  const router = useRouter();
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string[]>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [codeLanguages, setCodeLanguages] = useState<Record<string, Language>>(
    () => Object.fromEntries(questions.filter((q) => q.type === "CODING").map((q) => [q.id, "PYTHON" as Language]))
  );
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        questions
          .filter((q) => q.type === "CODING")
          .map((q) => [q.id, q.starterCodeByLanguage?.PYTHON ?? STARTER_CODE.PYTHON])
      )
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [runResults, setRunResults] = useState<Record<string, RunResult | null>>({});
  const [runErrors, setRunErrors] = useState<Record<string, string | null>>({});

  const deadline = useMemo(() => {
    if (!timeLimitMinutes) return null;
    return new Date(startedAt).getTime() + timeLimitMinutes * 60_000;
  }, [timeLimitMinutes, startedAt]);

  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const answers = questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: mcqAnswers[q.id] ?? [],
      textAnswer: textAnswers[q.id] ?? "",
      codeLanguage: q.type === "CODING" ? codeLanguages[q.id] : null,
      codeSubmission: q.type === "CODING" ? codeAnswers[q.id] : null,
    }));

    try {
      const res = await fetch(`/api/quiz-attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed with status ${res.status}`);
        setSubmitting(false);
        return;
      }
      router.push(`/quizzes`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleRun(questionId: string) {
    setRunning((prev) => ({ ...prev, [questionId]: true }));
    setRunErrors((prev) => ({ ...prev, [questionId]: null }));
    setRunResults((prev) => ({ ...prev, [questionId]: null }));
    try {
      const res = await fetch(`/api/quiz-attempts/${attemptId}/questions/${questionId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: codeLanguages[questionId], code: codeAnswers[questionId] }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) ?? "run failed");
      setRunResults((prev) => ({ ...prev, [questionId]: data as unknown as RunResult }));
    } catch (err) {
      setRunErrors((prev) => ({ ...prev, [questionId]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setRunning((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    if (!deadline) return;
    const dl = deadline;
    function tick() {
      const remaining = dl - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        submitRef.current();
      }
    }
    const interval = setInterval(tick, 1000);
    tick();
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">{quizTitle}</h1>
        {remainingMs !== null && (
          <span className={`text-sm font-medium ${remainingMs < 60_000 ? "text-danger" : "text-amber"}`}>
            {Math.max(0, Math.floor(remainingMs / 60000))}:{String(Math.max(0, Math.floor((remainingMs / 1000) % 60))).padStart(2, "0")} remaining
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-navy-border bg-navy-900 p-4">
            <div className="text-xs uppercase text-text-muted">
              Question {i + 1} &middot; {q.type}
            </div>

            {q.type === "MCQ" && (
              <div className="mt-2">
                <p className="text-sm text-foreground">{renderInlineCode(q.prompt ?? "")}</p>
                <div className="mt-3 flex flex-col gap-2">
                  {q.mcqOptions.map((opt) => {
                    const selected = mcqAnswers[q.id] ?? [];
                    const checked = selected.includes(opt.id);
                    return (
                      <label key={opt.id} className="flex min-h-[44px] items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setMcqAnswers((prev) => ({
                              ...prev,
                              [q.id]: e.target.checked
                                ? [...(prev[q.id] ?? []), opt.id]
                                : (prev[q.id] ?? []).filter((id) => id !== opt.id),
                            }))
                          }
                          className="h-5 w-5"
                        />
                        {opt.text}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {q.type === "DESCRIPTIVE" && (
              <div className="mt-2">
                <p className="text-sm text-foreground">{renderInlineCode(q.prompt ?? "")}</p>
                <textarea
                  rows={4}
                  value={textAnswers[q.id] ?? ""}
                  onChange={(e) => setTextAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  className="mt-2 w-full rounded border border-navy-border bg-navy-950 px-3 py-2 text-sm text-foreground"
                />
              </div>
            )}

            {q.type === "CODING" && q.codingQuestion && (
              <div className="mt-2">
                <p className="whitespace-pre-wrap text-sm text-foreground">{renderInlineCode(q.codingQuestion.description)}</p>
                {q.codingQuestion.constraints && (
                  <p className="mt-2 text-xs text-text-muted">{renderInlineCode(q.codingQuestion.constraints)}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={codeLanguages[q.id]}
                    onChange={(e) => {
                      const lang = e.target.value as Language;
                      setCodeLanguages((prev) => ({ ...prev, [q.id]: lang }));
                      setCodeAnswers((prev) => ({ ...prev, [q.id]: q.starterCodeByLanguage?.[lang] ?? STARTER_CODE[lang] }));
                    }}
                    className="select-field min-h-[44px] rounded border border-navy-border bg-navy-950 px-2 text-sm text-foreground"
                  >
                    {DSA_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {LANGUAGE_LABELS[lang]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRun(q.id)}
                    disabled={running[q.id]}
                    className="min-h-[44px] rounded bg-navy-800 px-4 text-sm font-medium text-cyan transition-colors hover:bg-navy-border disabled:opacity-50"
                  >
                    {running[q.id] ? "Running…" : "Run"}
                  </button>
                </div>
                <div className="mt-2 h-[300px]">
                  <Editor
                    height="100%"
                    language={MONACO_LANGUAGE_IDS[codeLanguages[q.id]]}
                    theme="vs-dark"
                    value={codeAnswers[q.id]}
                    onChange={(v) => setCodeAnswers((prev) => ({ ...prev, [q.id]: v ?? "" }))}
                    options={{ minimap: { enabled: false }, fontSize: 13 }}
                  />
                </div>
                {(runErrors[q.id] || runResults[q.id]) && (
                  <div className="mt-2 rounded border border-navy-border bg-navy-950 p-3 text-sm">
                    {runErrors[q.id] && <p className="text-danger">{runErrors[q.id]}</p>}
                    {runResults[q.id] && <RunResultDetail result={runResults[q.id]!} />}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting}
        className="mt-6 min-h-[44px] w-full rounded bg-mint px-4 text-sm font-medium text-navy-950 transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
      >
        {submitting ? "Submitting…" : "Submit Quiz"}
      </button>
    </div>
  );
}

function RunResultDetail({ result }: { result: RunResult }) {
  const { cases, firstFailure } = result.results;
  return (
    <div>
      <p className={result.passed ? "font-semibold text-mint" : "font-semibold text-danger"}>
        {result.passed ? "Passed" : "Failed"} ({cases.filter((c) => c.passed).length}/{cases.length} sample test
        cases)
      </p>
      <div className="mt-2 flex flex-wrap gap-1" aria-hidden="true">
        {cases.map((c) => (
          <span
            key={c.testCaseId}
            title={c.passed ? "Passed" : "Failed"}
            className={`h-2.5 w-2.5 rounded-full ${c.passed ? "bg-mint" : "bg-danger"}`}
          />
        ))}
      </div>
      {!result.passed && firstFailure && (
        <div className="mt-2 rounded border border-navy-border bg-navy-900 p-3 text-xs">
          {firstFailure.error ? (
            <>
              <div className="mb-1 text-text-muted">Error</div>
              <pre className="whitespace-pre-wrap text-danger">{firstFailure.error}</pre>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
