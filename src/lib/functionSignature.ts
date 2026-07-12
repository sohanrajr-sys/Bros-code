import { z } from "zod";

export const PARAM_TYPES = [
  "int",
  "double",
  "boolean",
  "string",
  "int[]",
  "double[]",
  "boolean[]",
  "string[]",
  "int[][]",
  "ListNode",
  "TreeNode",
] as const;

export type ParamType = (typeof PARAM_TYPES)[number];

export interface FunctionParam {
  name: string;
  type: ParamType;
}

export interface FunctionSignature {
  functionName: string;
  params: FunctionParam[];
  returnType: ParamType;
}

export const functionSignatureSchema = z.object({
  functionName: z.string().min(1),
  params: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(PARAM_TYPES),
      })
    )
    .min(1),
  returnType: z.enum(PARAM_TYPES),
}) satisfies z.ZodType<FunctionSignature>;
