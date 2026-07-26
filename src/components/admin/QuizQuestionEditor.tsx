"use client";

import { FunctionSignatureEditor } from "./FunctionSignatureEditor";
import { TestCaseListEditor, EMPTY_TEST_CASE, type TestCaseDraft } from "./TestCaseListEditor";
import type { FunctionSignature } from "@/lib/functionSignature";

export type QuestionDraft =
  | {
      type: "MCQ";
      order: number;
      weight: number;
      prompt: string;
      mcqScoringMode: "ALL_OR_NOTHING" | "PROPORTIONAL";
      mcqOptions: { text: string; isCorrect: boolean; order: number }[];
    }
  | {
      type: "DESCRIPTIVE";
      order: number;
      weight: number;
      prompt: string;
      descriptiveMode: "SHORT_ANSWER" | "LONG_ANSWER";
      acceptedKeywords: string[];
    }
  | {
      type: "CODING";
      order: number;
      weight: number;
      description: string;
      constraints: string | null;
      functionSignature: FunctionSignature;
      testCases: TestCaseDraft[];
    };

export const EMPTY_MCQ_QUESTION: QuestionDraft = {
  type: "MCQ",
  order: 0,
  weight: 0,
  prompt: "",
  mcqScoringMode: "ALL_OR_NOTHING",
  mcqOptions: [
    { text: "", isCorrect: false, order: 0 },
    { text: "", isCorrect: false, order: 1 },
  ],
};

export const EMPTY_DESCRIPTIVE_QUESTION: QuestionDraft = {
  type: "DESCRIPTIVE",
  order: 0,
  weight: 0,
  prompt: "",
  descriptiveMode: "SHORT_ANSWER",
  acceptedKeywords: [],
};

export const EMPTY_CODING_QUESTION: QuestionDraft = {
  type: "CODING",
  order: 0,
  weight: 0,
  description: "",
  constraints: null,
  functionSignature: { functionName: "", params: [{ name: "", type: "int" }], returnType: "int" },
  testCases: [{ ...EMPTY_TEST_CASE, order: 0 }],
};

export function QuizQuestionEditor({
  question,
  onChange,
  onRemove,
}: {
  question: QuestionDraft;
  onChange: (next: QuestionDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-navy-border bg-navy-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase text-text-muted">{question.type}</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-muted">
            Weight
            <input
              type="number"
              min={0}
              max={100}
              value={question.weight}
              onChange={(e) => onChange({ ...question, weight: Number(e.target.value) } as QuestionDraft)}
              className="min-h-[44px] w-20 rounded border border-navy-border bg-navy-950 px-2 text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={onRemove}
            className="min-h-[44px] rounded px-3 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            Remove question
          </button>
        </div>
      </div>

      {question.type === "MCQ" && (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Prompt</span>
            <textarea
              rows={2}
              value={question.prompt}
              onChange={(e) => onChange({ ...question, prompt: e.target.value })}
              className="w-full rounded border border-navy-border bg-navy-950 px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 sm:max-w-xs">
            <span className="text-xs text-text-muted">Scoring mode</span>
            <select
              value={question.mcqScoringMode}
              onChange={(e) =>
                onChange({ ...question, mcqScoringMode: e.target.value as "ALL_OR_NOTHING" | "PROPORTIONAL" })
              }
              className="select-field min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground"
            >
              <option value="ALL_OR_NOTHING">All or nothing</option>
              <option value="PROPORTIONAL">Proportional partial credit</option>
            </select>
          </label>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Options (check the correct one(s))</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...question,
                    mcqOptions: [...question.mcqOptions, { text: "", isCorrect: false, order: question.mcqOptions.length }],
                  })
                }
                className="min-h-[44px] rounded border border-navy-border px-3 text-sm text-cyan transition-colors hover:border-cyan"
              >
                Add option
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {question.mcqOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={opt.isCorrect}
                    onChange={(e) =>
                      onChange({
                        ...question,
                        mcqOptions: question.mcqOptions.map((o, j) => (j === i ? { ...o, isCorrect: e.target.checked } : o)),
                      })
                    }
                    className="h-5 w-5"
                  />
                  <input
                    value={opt.text}
                    onChange={(e) =>
                      onChange({
                        ...question,
                        mcqOptions: question.mcqOptions.map((o, j) => (j === i ? { ...o, text: e.target.value } : o)),
                      })
                    }
                    placeholder={`Option ${i + 1}`}
                    className="min-h-[44px] flex-1 rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground"
                  />
                  {question.mcqOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ ...question, mcqOptions: question.mcqOptions.filter((_, j) => j !== i) })
                      }
                      className="min-h-[44px] rounded px-3 text-sm text-danger transition-colors hover:bg-danger/10"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {question.type === "DESCRIPTIVE" && (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Prompt</span>
            <textarea
              rows={2}
              value={question.prompt}
              onChange={(e) => onChange({ ...question, prompt: e.target.value })}
              className="w-full rounded border border-navy-border bg-navy-950 px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 sm:max-w-xs">
            <span className="text-xs text-text-muted">Grading</span>
            <select
              value={question.descriptiveMode}
              onChange={(e) =>
                onChange({ ...question, descriptiveMode: e.target.value as "SHORT_ANSWER" | "LONG_ANSWER" })
              }
              className="select-field min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground"
            >
              <option value="SHORT_ANSWER">Short answer — auto-graded by keyword</option>
              <option value="LONG_ANSWER">Long answer — graded manually</option>
            </select>
          </label>
          {question.descriptiveMode === "SHORT_ANSWER" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Accepted keywords (comma-separated)</span>
              <input
                value={question.acceptedKeywords.join(", ")}
                onChange={(e) =>
                  onChange({
                    ...question,
                    acceptedKeywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
                  })
                }
                placeholder="O(log n), logarithmic"
                className="min-h-[44px] w-full rounded border border-navy-border bg-navy-950 px-3 text-sm text-foreground"
              />
            </label>
          )}
        </div>
      )}

      {question.type === "CODING" && (
        <div className="mt-3 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Description</span>
            <textarea
              rows={4}
              value={question.description}
              onChange={(e) => onChange({ ...question, description: e.target.value })}
              className="w-full rounded border border-navy-border bg-navy-950 px-3 py-2 text-sm text-foreground"
            />
          </label>
          <FunctionSignatureEditor
            value={question.functionSignature}
            onChange={(sig) => onChange({ ...question, functionSignature: sig })}
          />
          <TestCaseListEditor
            testCases={question.testCases}
            onChange={(testCases) => onChange({ ...question, testCases })}
          />
        </div>
      )}
    </div>
  );
}
