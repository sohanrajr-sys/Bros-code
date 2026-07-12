import type { FunctionSignature, ParamType } from "@/lib/functionSignature";
import type { LanguageCodegen } from "./types";

const PREAMBLE = `
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def _parse_list_node(line):
    vals = line.split()
    if not vals:
        return None
    head = ListNode(int(vals[0]))
    cur = head
    for v in vals[1:]:
        cur.next = ListNode(int(v))
        cur = cur.next
    return head

def _serialize_list_node(node):
    vals = []
    while node:
        vals.append(str(node.val))
        node = node.next
    return " ".join(vals)

def _parse_tree_node(line):
    tokens = line.split()
    if not tokens or tokens[0] == "#":
        return None
    root = TreeNode(int(tokens[0]))
    queue = [root]
    i = 1
    while queue and i < len(tokens):
        node = queue.pop(0)
        if i < len(tokens):
            if tokens[i] != "#":
                node.left = TreeNode(int(tokens[i]))
                queue.append(node.left)
            i += 1
        if i < len(tokens):
            if tokens[i] != "#":
                node.right = TreeNode(int(tokens[i]))
                queue.append(node.right)
            i += 1
    return root

def _serialize_tree_node(root):
    if root is None:
        return "#"
    result = [str(root.val)]
    queue = [root]
    while queue:
        node = queue.pop(0)
        if node.left:
            result.append(str(node.left.val))
            queue.append(node.left)
        else:
            result.append("#")
        if node.right:
            result.append(str(node.right.val))
            queue.append(node.right)
        else:
            result.append("#")
    while result and result[-1] == "#":
        result.pop()
    return " ".join(result)

def _fmt_double(d):
    s = f"{d:.6f}".rstrip("0").rstrip(".")
    return s if s else "0"
`.trim();

function parseExpr(type: ParamType, lineVar: string): string {
  switch (type) {
    case "int":
      return `int(${lineVar})`;
    case "double":
      return `float(${lineVar})`;
    case "boolean":
      return `${lineVar}.strip() == "true"`;
    case "string":
      return lineVar;
    case "int[]":
      return `[int(x) for x in ${lineVar}.split()] if ${lineVar}.strip() else []`;
    case "double[]":
      return `[float(x) for x in ${lineVar}.split()] if ${lineVar}.strip() else []`;
    case "boolean[]":
      return `[x == "true" for x in ${lineVar}.split()] if ${lineVar}.strip() else []`;
    case "string[]":
      return `${lineVar}.split(",") if ${lineVar}.strip() else []`;
    case "int[][]":
      return `[[int(v) for v in row.split(",")] for row in ${lineVar}.split(";")] if ${lineVar}.strip() else []`;
    case "ListNode":
      return `_parse_list_node(${lineVar})`;
    case "TreeNode":
      return `_parse_tree_node(${lineVar})`;
  }
}

function serializeExpr(type: ParamType, varName: string): string {
  switch (type) {
    case "int":
      return `str(${varName})`;
    case "double":
      return `_fmt_double(${varName})`;
    case "boolean":
      return `"true" if ${varName} else "false"`;
    case "string":
      return varName;
    case "int[]":
      return `" ".join(str(x) for x in ${varName})`;
    case "double[]":
      return `" ".join(_fmt_double(x) for x in ${varName})`;
    case "boolean[]":
      return `" ".join("true" if x else "false" for x in ${varName})`;
    case "string[]":
      return `",".join(${varName})`;
    case "int[][]":
      return `";".join(",".join(str(v) for v in row) for row in ${varName})`;
    case "ListNode":
      return `_serialize_list_node(${varName})`;
    case "TreeNode":
      return `_serialize_tree_node(${varName})`;
  }
}

export const pythonCodegen: LanguageCodegen = {
  starterTemplate(sig: FunctionSignature) {
    const params = sig.params.map((p) => p.name).join(", ");
    return `def ${sig.functionName}(${params}):\n    # your code here\n    pass\n`;
  },

  wrapForExecution(sig: FunctionSignature, studentCode: string) {
    const lines: string[] = ["import sys", "", PREAMBLE, "", studentCode.trimEnd(), "", "def _main():"];
    lines.push('    _lines = sys.stdin.read().split("\\n")');
    sig.params.forEach((p, i) => {
      lines.push(`    ${p.name} = ${parseExpr(p.type, `_lines[${i}]`)}`);
    });
    const argList = sig.params.map((p) => p.name).join(", ");
    lines.push(`    _result = ${sig.functionName}(${argList})`);
    lines.push(`    print(${serializeExpr(sig.returnType, "_result")})`);
    lines.push("", 'if __name__ == "__main__":', "    _main()");
    return lines.join("\n");
  },
};
