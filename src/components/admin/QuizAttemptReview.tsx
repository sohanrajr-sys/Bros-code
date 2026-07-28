"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { effectiveScore } from "@/lib/quizScoring";

interface AnswerDetail {
  id: string;
  questionId: string;
  autoScore: number | null;
  overriddenScore: number | null;
  gradingStatus: "PENDING" | "GRADED";
  textAnswer: string | null;
  codeLanguage: string | null;
  codeSubmission: string | null;
  selectedOptionIds: string[];
  question: {
    type: "MCQ" | "DESCRIPTIVE" | "CODING";
    prompt: string | null;
    weight: number;
    mcqOptions: { id: string; text: string; isCorrect: boolean }[];
    codingQuestion: { description: string; constraints: string | null } | null;
  };
}

export function QuizAttemptReview({
  attemptId,
  status,
  answers,
}: {
  attemptId: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "FINALIZED";
  answers: AnswerDetail[];
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(answers.map((a) => [a.questionId, effectiveScore(a.autoScore, a.overriddenScore)]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveOverride(questionId: string) {
    setSaving(questionId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quiz-attempts/${attemptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, overriddenScore: scores[questionId] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save score");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  async function finalize() {
    setFinalizing(true);
    setError(null);
    const res = await fetch(`/api/admin/quiz-attempts/${attemptId}/finalize`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to finalize");
      setFinalizing(false);
      return;
    }
    router.refresh();
  }

  const hasPending = answers.some((a) => a.gradingStatus === "PENDING");
  const total = answers.reduce((sum, a) => sum + effectiveScore(a.autoScore, a.overriddenScore), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-navy-border bg-navy-900 p-4">
        <span className="text-sm text-text-muted">Current total: </span>
        <span className="text-lg font-semibold text-foreground">{total}/100</span>
      </div>

      {answers.map((a) => (
        <div key={a.id} className="rounded-lg border border-navy-border bg-navy-900 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-text-muted">
              {a.question.type} &middot; weight {a.question.weight}
            </span>
            {a.gradingStatus === "PENDING" && (
              <span className="rounded bg-amber/15 px-2 py-0.5 text-xs text-amber">Pending review</span>
            )}
          </div>
          {a.question.type === "CODING" && a.question.codingQuestion ? (
            <>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{a.question.codingQuestion.description}</p>
              {a.question.codingQuestion.constraints && (
                <p className="mt-1 text-xs text-text-muted">{a.question.codingQuestion.constraints}</p>
              )}
            </>
          ) : (
            a.question.prompt && <p className="mt-2 text-sm text-foreground">{a.question.prompt}</p>
          )}
          {a.question.type === "MCQ" && (
            <ul className="mt-2 flex flex-col gap-1">
              {a.question.mcqOptions.map((opt) => {
                const selected = a.selectedOptionIds.includes(opt.id);
                return (
                  <li
                    key={opt.id}
                    className={`rounded border px-3 py-1.5 text-sm ${
                      opt.isCorrect
                        ? "border-mint/40 bg-mint/10 text-mint"
                        : selected
                          ? "border-danger/40 bg-danger/10 text-danger"
                          : "border-navy-border text-text-muted"
                    }`}
                  >
                    {selected ? "☑" : "☐"} {opt.text}
                    {opt.isCorrect && <span className="ml-2 text-xs">(correct)</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {a.textAnswer && (
            <p className="mt-2 whitespace-pre-wrap rounded border border-navy-border bg-navy-950 p-3 text-sm text-text">
              {a.textAnswer}
            </p>
          )}
          {a.codeSubmission && (
            <>
              {a.codeLanguage && <div className="mb-1 mt-2 text-xs text-text-muted">{a.codeLanguage}</div>}
              <pre className="overflow-x-auto rounded border border-navy-border bg-navy-950 p-3 text-xs text-text">
                {a.codeSubmission}
              </pre>
            </>
          )}
          <div className="mt-3 flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-text-muted">
              Score
              <input
                type="number"
                min={0}
                max={a.question.weight}
                value={scores[a.questionId]}
                onChange={(e) => setScores((prev) => ({ ...prev, [a.questionId]: Number(e.target.value) }))}
                className="min-h-[44px] w-20 rounded border border-navy-border bg-navy-950 px-2 text-foreground"
              />
              / {a.question.weight}
            </label>
            <button
              onClick={() => saveOverride(a.questionId)}
              disabled={saving === a.questionId}
              className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan disabled:opacity-50"
            >
              {saving === a.questionId ? "Saving…" : "Save score"}
            </button>
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-danger">{error}</p>}

      {status !== "FINALIZED" && (
        <button
          onClick={finalize}
          disabled={hasPending || finalizing}
          className="min-h-[44px] w-fit rounded bg-mint px-4 text-sm font-medium text-navy-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          title={hasPending ? "Every question needs a score before finalizing" : undefined}
        >
          {finalizing ? "Finalizing…" : "Finalize"}
        </button>
      )}
      {status === "FINALIZED" && <p className="text-sm text-mint">Finalized — visible to the student.</p>}
    </div>
  );
}
