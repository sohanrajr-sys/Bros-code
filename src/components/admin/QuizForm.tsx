"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  QuizQuestionEditor,
  EMPTY_MCQ_QUESTION,
  EMPTY_DESCRIPTIVE_QUESTION,
  EMPTY_CODING_QUESTION,
  type QuestionDraft,
} from "./QuizQuestionEditor";

export type QuizFormInitial = {
  title: string;
  description: string;
  status: "DRAFT" | "PUBLISHED";
  opensAt: string;
  closesAt: string;
  timeLimitMinutes: string;
  maxAttempts: number;
  questions: QuestionDraft[];
};

function defaultState(): QuizFormInitial {
  return {
    title: "",
    description: "",
    status: "DRAFT",
    opensAt: "",
    closesAt: "",
    timeLimitMinutes: "",
    maxAttempts: 1,
    questions: [],
  };
}

export function QuizForm({
  mode,
  quizId,
  initial,
}: {
  mode: "create" | "edit";
  quizId?: string;
  initial?: QuizFormInitial;
}) {
  const router = useRouter();
  const [form, setForm] = useState<QuizFormInitial>(initial ?? defaultState());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalWeight = form.questions.reduce((sum, q) => sum + (q.weight || 0), 0);
  const canPublish = totalWeight === 100 && form.questions.length > 0;

  function addQuestion(template: QuestionDraft) {
    setForm((p) => ({
      ...p,
      // structuredClone, not a shallow spread — otherwise every question
      // added from the same "Add X" click shares the same nested
      // mcqOptions/testCases array reference until an onChange replaces it.
      questions: [...p.questions, { ...structuredClone(template), order: p.questions.length }],
    }));
  }

  function updateQuestion(index: number, next: QuestionDraft) {
    setForm((p) => ({ ...p, questions: p.questions.map((q, i) => (i === index ? next : q)) }));
  }

  function removeQuestion(index: number) {
    setForm((p) => ({ ...p, questions: p.questions.filter((_, i) => i !== index) }));
  }

  async function submitAs(status: "DRAFT" | "PUBLISHED", e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const baseBody = {
      title: form.title,
      description: form.description,
      opensAt: form.opensAt ? new Date(form.opensAt).toISOString() : null,
      closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : null,
      timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : null,
      maxAttempts: form.maxAttempts,
      questions: form.questions.map((q, i) => ({ ...q, order: i })),
    };

    async function putJson(url: string, status: "DRAFT" | "PUBLISHED") {
      return fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, status }),
      });
    }

    try {
      if (mode === "create") {
        // POST always creates as DRAFT regardless of what's sent (the API
        // enforces this — only PUT re-validates weights/question count and
        // is allowed to publish). So publishing on create is a real two-step
        // flow: create the draft, then immediately PUT it to PUBLISHED.
        const createRes = await fetch("/api/admin/quizzes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, status: "DRAFT" }),
        });
        if (!createRes.ok) {
          const data = await createRes.json().catch(() => ({}));
          setError(data.error ?? `Request failed with status ${createRes.status}`);
          setSubmitting(false);
          return;
        }
        if (status === "PUBLISHED") {
          const { quiz } = await createRes.json();
          const publishRes = await putJson(`/api/admin/quizzes/${quiz.id}`, "PUBLISHED");
          if (!publishRes.ok) {
            const data = await publishRes.json().catch(() => ({}));
            setError(`Saved as draft, but publishing failed: ${data.error ?? publishRes.status}`);
            setSubmitting(false);
            return;
          }
        }
      } else {
        const res = await putJson(`/api/admin/quizzes/${quizId}`, status);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Request failed with status ${res.status}`);
          setSubmitting(false);
          return;
        }
      }
      router.push("/admin/quizzes");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => submitAs("DRAFT", e)} className="flex w-full flex-col gap-6">
      {error && (
        <div className="rounded border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-text-muted">Title</span>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-text-muted">Description</span>
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className="w-full rounded border border-navy-border bg-navy-900 px-3 py-2 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Opens at (optional)</span>
          <input
            type="datetime-local"
            value={form.opensAt}
            onChange={(e) => setForm((p) => ({ ...p, opensAt: e.target.value }))}
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Closes at (optional)</span>
          <input
            type="datetime-local"
            value={form.closesAt}
            onChange={(e) => setForm((p) => ({ ...p, closesAt: e.target.value }))}
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Time limit, minutes (optional)</span>
          <input
            type="number"
            min={1}
            value={form.timeLimitMinutes}
            onChange={(e) => setForm((p) => ({ ...p, timeLimitMinutes: e.target.value }))}
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Max attempts</span>
          <input
            type="number"
            min={1}
            required
            value={form.maxAttempts}
            onChange={(e) => setForm((p) => ({ ...p, maxAttempts: Number(e.target.value) }))}
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">
            Questions &middot;{" "}
            <span className={totalWeight === 100 ? "text-mint" : "text-amber"}>{totalWeight}/100 weight</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => addQuestion(EMPTY_MCQ_QUESTION)} className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan">
              Add MCQ
            </button>
            <button type="button" onClick={() => addQuestion(EMPTY_DESCRIPTIVE_QUESTION)} className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan">
              Add descriptive
            </button>
            <button type="button" onClick={() => addQuestion(EMPTY_CODING_QUESTION)} className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan">
              Add coding
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-4">
          {form.questions.map((q, i) => (
            <QuizQuestionEditor key={i} question={q} onChange={(next) => updateQuestion(i, next)} onRemove={() => removeQuestion(i)} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] rounded border border-navy-border px-4 text-sm font-medium text-foreground transition-colors hover:border-cyan disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="button"
          disabled={submitting || !canPublish}
          onClick={(e) => submitAs("PUBLISHED", e)}
          title={canPublish ? undefined : "Add at least one question and make weights sum to 100 before publishing"}
          className="min-h-[44px] rounded bg-mint px-4 text-sm font-medium text-navy-950 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Publish"}
        </button>
      </div>
    </form>
  );
}
