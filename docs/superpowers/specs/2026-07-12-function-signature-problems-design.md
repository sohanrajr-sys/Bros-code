# Function-Signature Problems (LeetCode-Style Stubs) — Design

## Summary

Amends the original [code judge platform design](2026-07-12-code-judge-platform-design.md), specifically its "Test cases are authored as input/output text pairs" decision for DSA problems. That decision produced starter code with no function signature — students got a bare `main()` reading raw stdin, not LeetCode's familiar `def twoSum(self, nums, target):` stub. This spec adds function signatures on top of the existing stdin/stdout grading model, without changing how Judge0 execution or SQL grading work.

## Goals

- Admin defines a function signature (name, typed params, return type) per DSA problem.
- Student's editor shows only a language-appropriate function stub — no visible driver/boilerplate, matching real LeetCode.
- Support a bounded, concrete type set — not arbitrary user-defined classes. This was explicitly scoped down during design: "every type including custom classes" was rejected as an open-ended general-serialization problem; instead we support primitives, arrays, and the two structures LeetCode itself repeatedly reuses (`ListNode`, `TreeNode`).

## Non-Goals

- Arbitrary admin-defined custom classes (e.g., an admin-specified `Employee { name, age }` shape). Out of scope — see Goals.
- Multi-dimensional arrays beyond 2D (`int[][]`). No `int[][][]`.
- `ListNode`/`TreeNode` of non-`int` element types.
- Changing `TestCase.input`/`TestCase.expectedOutput` storage — they remain plain text columns; only the *convention* for what that text encodes changes for function-signature problems.

## Data Model

Add one field to `Problem`:

```
functionSignature  Json?   // null for SQL problems; required for DSA problems going forward
```

Shape (validated at the application layer, not by Postgres):

```ts
interface FunctionSignature {
  functionName: string;
  params: { name: string; type: ParamType }[];
  returnType: ParamType;
}

type ParamType =
  | "int" | "double" | "boolean" | "string"
  | "int[]" | "double[]" | "boolean[]" | "string[]"
  | "int[][]"
  | "ListNode" | "TreeNode";
```

`TestCase.input` and `TestCase.expectedOutput` are unchanged as columns, but for a problem with a `functionSignature`, their *content* follows the line-encoding below instead of being arbitrary stdin/stdout text.

## Line Encoding

Chosen over JSON deliberately: Judge0's C/C++/Java sandboxes have no bundled JSON library, and pulling one in means per-language dependency management inside an already-constrained sandbox. A hand-rollable, whitespace/delimiter-based format needs no library in any of the 6 languages.

One line per parameter, in signature order, for `input`. One line for `expectedOutput` (the return value). Per type:

| Type | Encoding | Example |
|---|---|---|
| `int` / `double` | raw value | `42` / `3.14` |
| `boolean` | `true` / `false` | `true` |
| `string` | raw line (no embedded newline) | `hello world` |
| `int[]` / `double[]` / `boolean[]` | space-separated | `2 7 11 15` |
| `string[]` | comma-separated (no embedded-comma support in v1) | `flower,flow,flight` |
| `int[][]` | rows separated by `;`, values by `,` | `1,2;3,4` |
| `ListNode` | space-separated ints, list order | `1 2 3 4` |
| `TreeNode` | level-order, `#` for null | `3 9 20 # # 15 7` |

## Driver Generation (hidden from the student)

The student's editor shows and edits **only** the function stub — e.g., for Two Sum in Python: `def twoSum(nums, target):` with a `# your code here` body. No visible `main()`, no visible stdin parsing, matching real LeetCode.

At Run/Submit time, the submitted code is combined with a **generated driver** (parses stdin per the encoding table, calls the function, prints the result per the same encoding) before being sent to Judge0. The driver is never shown to the student and never stored as part of what they edit — only `submission.code` (the stub + their implementation) is persisted; the wrapped/combined source is ephemeral, built fresh for each grading run.

Each language implements a shared interface in `src/lib/codegen/<language>.ts`:

```ts
interface LanguageCodegen {
  starterTemplate(sig: FunctionSignature): string;       // shown to student
  wrapForExecution(sig: FunctionSignature, studentCode: string): string; // sent to Judge0
}
```

Per-language combination order (dictated by each language's syntax rules):
- **Python, Go, Scala:** driver's imports/parsing helpers first, student's function/object body inserted, then the driver's entry point (`if __name__ == "__main__":` / `func main()` / `object Main`) appended last.
- **C, C++:** includes first, student's function definition next, driver's `main()` last (C/C++ require the function to be defined or declared before `main()` calls it).
- **Java:** student's code is the full `class Solution { ... }` body; driver supplies `public class Main { public static void main(...) { ... } }` — only one top-level class may be `public`, so `Main` holds `main()` and `Solution` (student's, non-public) is concatenated alongside it. Judge0 compiles the file as `Main.java`.

`C`'s array *return* type needs special handling other languages don't: idiomatic C has no dynamic array/vector, so a `T[]`-returning signature compiles to C as `T* functionName(..., int* returnSize)` (LeetCode's own C convention) rather than a plain return — this is called out explicitly in the C codegen module, not left implicit.

## Migration

The seeded `two-sum` problem becomes the reference example: `functionSignature = { functionName: "twoSum", params: [{name: "nums", type: "int[]"}, {name: "target", type: "int"}], returnType: "int[]" }`. Its test cases are re-encoded to the line format above (dropping the old explicit array-length line: `"2 7 11 15\n9"` → expected output `"0 1"`).

## Admin UI

The problem-authoring form (for `type: "DSA"` problems) gains a function-signature editor: function name text input, a repeatable param row (name + type dropdown), and a return-type dropdown, using the same responsive/touch-target conventions as the rest of the admin UI.

## Verification Plan

Judge0 itself is still blocked in this sandbox (cgroup limitation, per the earlier judge-execution work) — so verification here does **not** depend on Judge0. Instead, for each of the 6 languages: generate a driver + a correct reference solution via the new codegen module, compile/run the **combined source locally** (Python/C/C++/Java/Go/Scala toolchains are all installed on this machine), and confirm stdout matches the expected encoded output exactly. This is strictly stronger verification than what was possible for the original Judge0 integration, since it doesn't depend on the sandbox that's known to be broken here.

## Open Questions / Future Work

- Arbitrary custom classes (explicitly deferred, see Non-Goals).
- `ListNode`/`TreeNode` of non-`int` types, if a future problem needs it.
- Escaping support for `string[]` elements containing commas.
