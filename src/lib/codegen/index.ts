import type { Language } from "@/generated/prisma/enums";
import type { LanguageCodegen } from "./types";
import { pythonCodegen } from "./python";
import { cppCodegen } from "./cpp";
import { cCodegen } from "./c";
import { javaCodegen } from "./java";
import { goCodegen } from "./go";
import { scalaCodegen } from "./scala";

export type { LanguageCodegen } from "./types";

export const CODEGEN_BY_LANGUAGE: Partial<Record<Language, LanguageCodegen>> = {
  PYTHON: pythonCodegen,
  CPP: cppCodegen,
  C: cCodegen,
  JAVA: javaCodegen,
  GO: goCodegen,
  SCALA: scalaCodegen,
};

export function getCodegen(language: Language): LanguageCodegen | undefined {
  return CODEGEN_BY_LANGUAGE[language];
}
