"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type FunctionSignature } from "@/lib/functionSignature";
import { FunctionSignatureEditor } from "./FunctionSignatureEditor";
import { TestCaseListEditor, EMPTY_TEST_CASE, type TestCaseDraft } from "./TestCaseListEditor";

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

      <TestCaseListEditor
        testCases={form.testCases}
        onChange={(testCases) => setForm((p) => ({ ...p, testCases }))}
        functionSignature={form.type === "DSA" ? form.functionSignature : null}
      />

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
