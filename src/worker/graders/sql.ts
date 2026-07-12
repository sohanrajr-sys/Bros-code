import { Client } from "pg";
import type { TestCase } from "@/generated/prisma/client";
import type { FirstFailure, GradeOutcome, TestCaseResult } from "../types";

interface PgField {
  name: string;
}

function serializeResultSet(fields: PgField[], rows: Record<string, unknown>[]): string {
  const header = fields.map((field) => field.name).join(",");
  const lines = rows.map((row) =>
    fields
      .map((field) => {
        const value = row[field.name];
        if (value === null || value === undefined) return "";
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        return String(value);
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

// Postgres unquoted identifiers must be letters/digits/underscores; cuid()
// ids already satisfy that, this is just a defensive backstop.
function schemaName(submissionId: string, index: number): string {
  const safeId = submissionId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `sub_${safeId}_${index}`;
}

export async function gradeSql(
  submissionId: string,
  code: string,
  testCases: TestCase[]
): Promise<GradeOutcome> {
  const cases: TestCaseResult[] = [];
  let firstFailure: FirstFailure | undefined;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const schema = schemaName(submissionId, i);
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    let passed = false;
    let actualOutput = "";
    let errorMessage: string | undefined;

    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(testCase.input);
      const result = await client.query(code);
      actualOutput = serializeResultSet((result.fields ?? []) as PgField[], result.rows ?? []);
      passed = actualOutput.trim() === testCase.expectedOutput.trim();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      passed = false;
    } finally {
      try {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } catch {
        // best-effort cleanup — a leaked schema doesn't affect grading correctness
      }
      await client.end();
    }

    cases.push({ testCaseId: testCase.id, passed, isHidden: testCase.isHidden });

    if (!passed && !firstFailure) {
      firstFailure = {
        testCaseId: testCase.id,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: errorMessage ?? actualOutput,
        error: errorMessage,
      };
    }
  }

  return {
    passed: cases.every((c) => c.passed),
    results: { cases, firstFailure },
  };
}
