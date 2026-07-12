import { z } from "zod";
import { functionSignatureSchema } from "./functionSignature";

export const testCaseInputSchema = z.object({
  input: z.string().min(1, "Test case input is required"),
  expectedOutput: z.string().min(1, "Test case expected output is required"),
  isHidden: z.boolean().default(false),
  order: z.number().int().nonnegative(),
});

export const problemInputSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase, alphanumeric, hyphen-separated"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  tags: z.array(z.string()).default([]),
  type: z.enum(["DSA", "SQL"]),
  constraints: z.string().optional().nullable(),
  functionSignature: functionSignatureSchema.optional().nullable(),
  testCases: z.array(testCaseInputSchema).min(1, "At least one test case is required"),
});

export type ProblemInput = z.infer<typeof problemInputSchema>;
