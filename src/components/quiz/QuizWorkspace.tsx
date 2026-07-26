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
    () => Object.fromEntries(questions.filter((q) => q.type === "CODING").map((q) => [q.id, STARTER_CODE.PYTHON]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                <select
                  value={codeLanguages[q.id]}
                  onChange={(e) => {
                    const lang = e.target.value as Language;
                    setCodeLanguages((prev) => ({ ...prev, [q.id]: lang }));
                    setCodeAnswers((prev) => ({ ...prev, [q.id]: STARTER_CODE[lang] }));
                  }}
                  className="select-field mt-3 min-h-[44px] rounded border border-navy-border bg-navy-950 px-2 text-sm text-foreground"
                >
                  {DSA_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {LANGUAGE_LABELS[lang]}
                    </option>
                  ))}
                </select>
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
