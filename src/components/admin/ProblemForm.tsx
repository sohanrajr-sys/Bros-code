"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type FunctionSignature } from "@/lib/functionSignature";
import { FunctionSignatureEditor } from "./FunctionSignatureEditor";

type TestCaseDraft = {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  order: number;
};

export type ProblemFormInitial = {
  slug: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  type: "DSA" | "SQL";
  constraints: string;
  tags: string[];
  functionSignature: FunctionSignature | null;
  testCases: TestCaseDraft[];
};

const EMPTY_TEST_CASE: TestCaseDraft = {
  input: "",
  expectedOutput: "",
  isHidden: false,
  order: 0,
};

const EMPTY_SIGNATURE: FunctionSignature = {
  functionName: "",
  params: [{ name: "", type: "int" }],
  returnType: "int",
};

function defaultState(): ProblemFormInitial {
  return {
    slug: "",
    title: "",
    description: "",
    difficulty: "EASY",
    type: "DSA",
    constraints: "",
    tags: [],
    functionSignature: EMPTY_SIGNATURE,
    testCases: [{ ...EMPTY_TEST_CASE, order: 0 }],
  };
}

export function ProblemForm({
  mode,
  problemId,
  initial,
}: {
  mode: "create" | "edit";
  problemId?: string;
  initial?: ProblemFormInitial;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProblemFormInitial>(initial ?? defaultState());
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(", "));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateTestCase(index: number, patch: Partial<TestCaseDraft>) {
    setForm((prev) => ({
      ...prev,
      testCases: prev.testCases.map((tc, i) => (i === index ? { ...tc, ...patch } : tc)),
    }));
  }

  function addTestCase() {
    setForm((prev) => ({
      ...prev,
      testCases: [...prev.testCases, { ...EMPTY_TEST_CASE, order: prev.testCases.length }],
    }));
  }

  function removeTestCase(index: number) {
    setForm((prev) => ({
      ...prev,
      testCases: prev.testCases.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const hasSignature = form.type === "DSA" && (form.functionSignature?.functionName ?? "").trim().length > 0;

    const body = {
      slug: form.slug,
      title: form.title,
      description: form.description,
      difficulty: form.difficulty,
      type: form.type,
      constraints: form.constraints || null,
      tags,
      functionSignature: hasSignature
        ? {
            ...form.functionSignature,
            params: form.functionSignature!.params.filter((p) => p.name.trim().length > 0),
          }
        : null,
      testCases: form.testCases.map((tc, i) => ({ ...tc, order: tc.order ?? i })),
    };

    const url = mode === "create" ? "/api/admin/problems" : `/api/admin/problems/${problemId}`;
    const method = mode === "create" ? "POST" : "PUT";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed with status ${res.status}`);
        setSubmitting(false);
        return;
      }

      router.push("/admin/problems");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
      {error && (
        <div className="rounded border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Title</span>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Slug</span>
          <input
            required
            value={form.slug}
            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
            placeholder="two-sum"
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Difficulty</span>
          <select
            value={form.difficulty}
            onChange={(e) =>
              setForm((p) => ({ ...p, difficulty: e.target.value as ProblemFormInitial["difficulty"] }))
            }
            className="select-field min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          >
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Type</span>
          <select
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ProblemFormInitial["type"] }))}
            className="select-field min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          >
            <option value="DSA">DSA</option>
            <option value="SQL">SQL</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-text-muted">Tags (comma-separated)</span>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="arrays, hash-map"
            className="min-h-[44px] w-full rounded border border-navy-border bg-navy-900 px-3 text-foreground"
          />
        </label>
      </div>

      {form.type === "DSA" && (
        <FunctionSignatureEditor
          value={form.functionSignature ?? EMPTY_SIGNATURE}
          onChange={(sig) => setForm((p) => ({ ...p, functionSignature: sig }))}
        />
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">Description (markdown)</span>
        <textarea
          required
          rows={8}
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          className="w-full rounded border border-navy-border bg-navy-900 px-3 py-2 text-foreground"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">Constraints (optional)</span>
        <textarea
          rows={3}
          value={form.constraints}
          onChange={(e) => setForm((p) => ({ ...p, constraints: e.target.value }))}
          className="w-full rounded border border-navy-border bg-navy-900 px-3 py-2 text-foreground"
        />
      </label>

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
          {form.testCases.map((tc, index) => (
            <div
              key={index}
              className="rounded-lg border border-navy-border bg-navy-900 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-text-muted">Test case {index + 1}</span>
                {form.testCases.length > 1 && (
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] w-full rounded bg-cyan/15 px-4 text-sm font-medium text-cyan transition-colors hover:bg-cyan/25 disabled:opacity-50 sm:w-auto"
        >
          {submitting ? "Saving..." : mode === "create" ? "Create problem" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
