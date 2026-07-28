"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { bulkCreateStudents, type BulkCreateState } from "./actions";

const initialState: BulkCreateState = {};

const CSV_HEADER_PATTERN = /^studentid$/i;

// Minimal CSV field splitter — handles double-quoted fields (with "" as an
// escaped quote) so names exported from Excel/Sheets with embedded commas
// still parse correctly, without pulling in a CSV parsing dependency for a
// two-column format.
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function parseCsvText(text: string): { studentId: string; name: string }[] {
  // Strip a UTF-8 BOM (common in Excel-exported CSVs), written via charCodeAt
  // rather than a literal character in the regex to avoid an invisible
  // zero-width character sitting in the source file.
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = withoutBom
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const headerFields = splitCsvLine(lines[0]);
  if (!CSV_HEADER_PATTERN.test(headerFields[0] ?? "")) {
    throw new Error('CSV must start with a header row: "studentId,name".');
  }

  const dataLines = lines.slice(1);
  if (dataLines.length === 0) {
    throw new Error("CSV has a header row but no student rows below it.");
  }

  return dataLines.map((line) => {
    const fields = splitCsvLine(line);
    const studentId = fields[0] ?? "";
    const name = fields.slice(1).join(", ").trim() || studentId;
    return { studentId, name };
  });
}

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
  const [rows, setRows] = useState("");
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvLoadedCount, setCsvLoadedCount] = useState<number | null>(null);

  async function handleCsvUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so re-uploading the same filename still fires onChange
    if (!file) return;

    try {
      const text = await file.text();
      const parsedRows = parseCsvText(text);
      setRows(parsedRows.map((r) => `${r.studentId}, ${r.name}`).join("\n"));
      setCsvError(null);
      setCsvLoadedCount(parsedRows.length);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "Could not read that CSV file.");
      setCsvLoadedCount(null);
    }
  }

  return (
    <div className="rounded-lg border border-navy-border bg-navy-900 p-4">
      <h2 className="text-sm font-medium text-foreground">Add students</h2>
      <p className="mt-1 text-xs text-text-muted">
        One student per line: <code className="text-text">studentId, name</code>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded border border-navy-border bg-navy-950 px-3 py-2">
        <label className="text-xs text-text-muted">
          <span className="mr-2 inline-block rounded border border-navy-border px-2 py-1 text-xs text-foreground transition-colors hover:border-cyan hover:text-cyan">
            Upload CSV
          </span>
          <input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} className="hidden" />
        </label>
        <p className="text-xs text-text-muted">
          CSV must have a header row <code className="text-text">studentId,name</code>, then one student per row
          &mdash; e.g. <code className="text-text">2026-CSE-0417,Rohan Kulkarni</code>. This fills in the field
          below so you can review it before adding.
        </p>
      </div>
      {csvError && <p className="mt-2 text-xs text-danger">{csvError}</p>}
      {csvLoadedCount !== null && !csvError && (
        <p className="mt-2 text-xs text-cyan">
          {`Loaded ${csvLoadedCount} student${csvLoadedCount === 1 ? "" : "s"} from CSV — review below, then click Add students.`}
        </p>
      )}

      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <textarea
          name="rows"
          rows={5}
          required
          value={rows}
          onChange={(e) => setRows(e.target.value)}
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
