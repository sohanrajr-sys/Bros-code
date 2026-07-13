"use client";

import { useActionState, useState } from "react";
import { bulkCreateStudents, type BulkCreateState } from "./actions";

const initialState: BulkCreateState = {};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded border border-navy-border px-2 py-0.5 text-xs text-text-muted transition-colors hover:border-cyan hover:text-cyan"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function BulkAddForm() {
  const [state, formAction, pending] = useActionState(bulkCreateStudents, initialState);

  return (
    <div className="rounded-lg border border-navy-border bg-navy-900 p-4">
      <h2 className="text-sm font-medium text-foreground">Add students</h2>
      <p className="mt-1 text-xs text-text-muted">
        One student per line: <code className="text-text">studentId, name</code>
      </p>

      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <textarea
          name="rows"
          rows={5}
          required
          placeholder={"2026-CSE-0417, Rohan Kulkarni\n2026-CSE-0421, Meera Iyer"}
          className="rounded border border-navy-border bg-navy-950 px-3 py-2 text-sm text-foreground placeholder:text-text-muted/60"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[44px] w-fit items-center justify-center rounded bg-cyan/15 px-4 text-sm font-medium text-cyan transition-colors hover:bg-cyan/25 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add students"}
        </button>
      </form>

      {state.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}

      {state.created && state.created.length > 0 && (
        <div className="mt-4 rounded border border-amber/30 bg-amber/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-amber">
              These passwords are shown once — copy them now before leaving this page.
            </p>
            <CopyButton
              text={state.created.map((s) => `${s.studentId}, ${s.name}, ${s.password}`).join("\n")}
            />
          </div>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="text-text-muted">
                <th className="py-1 pr-4 font-medium">Student ID</th>
                <th className="py-1 pr-4 font-medium">Name</th>
                <th className="py-1 pr-4 font-medium">Password</th>
                <th className="py-1 font-medium" />
              </tr>
            </thead>
            <tbody>
              {state.created.map((s) => (
                <tr key={s.studentId} className="border-t border-navy-border/60">
                  <td className="py-1 pr-4 text-foreground">{s.studentId}</td>
                  <td className="py-1 pr-4 text-foreground">{s.name}</td>
                  <td className="py-1 pr-4 font-mono text-cyan">{s.password}</td>
                  <td className="py-1">
                    <CopyButton text={s.password} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
