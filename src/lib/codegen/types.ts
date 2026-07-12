import type { FunctionSignature } from "@/lib/functionSignature";

export interface LanguageCodegen {
  /** Shown to and edited by the student — just the function stub. */
  starterTemplate(sig: FunctionSignature): string;
  /** Full source sent to the execution backend — student code + generated driver. */
  wrapForExecution(sig: FunctionSignature, studentCode: string): string;
}
