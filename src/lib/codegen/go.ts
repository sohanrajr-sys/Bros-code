import type { FunctionSignature, ParamType } from "@/lib/functionSignature";
import type { LanguageCodegen } from "./types";

const PREAMBLE = `
type ListNode struct {
	Val  int
	Next *ListNode
}

type TreeNode struct {
	Val   int
	Left  *TreeNode
	Right *TreeNode
}

func _atoi(s string) int {
	v, _ := strconv.Atoi(s)
	return v
}

func _atof(s string) float64 {
	v, _ := strconv.ParseFloat(s, 64)
	return v
}

func _fmtDouble(d float64) string {
	s := strconv.FormatFloat(d, 'f', 6, 64)
	s = strings.TrimRight(s, "0")
	s = strings.TrimRight(s, ".")
	if s == "" {
		return "0"
	}
	return s
}

func _parseListNode(line string) *ListNode {
	line = strings.TrimSpace(line)
	if line == "" {
		return nil
	}
	parts := strings.Fields(line)
	head := &ListNode{Val: _atoi(parts[0])}
	cur := head
	for _, p := range parts[1:] {
		cur.Next = &ListNode{Val: _atoi(p)}
		cur = cur.Next
	}
	return head
}

func _serializeListNode(node *ListNode) string {
	var vals []string
	for node != nil {
		vals = append(vals, strconv.Itoa(node.Val))
		node = node.Next
	}
	return strings.Join(vals, " ")
}

func _parseTreeNode(line string) *TreeNode {
	tokens := strings.Fields(line)
	if len(tokens) == 0 || tokens[0] == "#" {
		return nil
	}
	root := &TreeNode{Val: _atoi(tokens[0])}
	queue := []*TreeNode{root}
	i := 1
	for len(queue) > 0 && i < len(tokens) {
		node := queue[0]
		queue = queue[1:]
		if i < len(tokens) {
			if tokens[i] != "#" {
				node.Left = &TreeNode{Val: _atoi(tokens[i])}
				queue = append(queue, node.Left)
			}
			i++
		}
		if i < len(tokens) {
			if tokens[i] != "#" {
				node.Right = &TreeNode{Val: _atoi(tokens[i])}
				queue = append(queue, node.Right)
			}
			i++
		}
	}
	return root
}

func _serializeTreeNode(root *TreeNode) string {
	if root == nil {
		return "#"
	}
	result := []string{strconv.Itoa(root.Val)}
	queue := []*TreeNode{root}
	for len(queue) > 0 {
		node := queue[0]
		queue = queue[1:]
		if node.Left != nil {
			result = append(result, strconv.Itoa(node.Left.Val))
			queue = append(queue, node.Left)
		} else {
			result = append(result, "#")
		}
		if node.Right != nil {
			result = append(result, strconv.Itoa(node.Right.Val))
			queue = append(queue, node.Right)
		} else {
			result = append(result, "#")
		}
	}
	for len(result) > 0 && result[len(result)-1] == "#" {
		result = result[:len(result)-1]
	}
	return strings.Join(result, " ")
}
`.trim();

function parseExpr(type: ParamType, lineVar: string): string {
  switch (type) {
    case "int":
      return `_atoi(${lineVar})`;
    case "double":
      return `_atof(${lineVar})`;
    case "boolean":
      return `${lineVar} == "true"`;
    case "string":
      return lineVar;
    case "int[]":
      return `func() []int { f := strings.Fields(${lineVar}); r := make([]int, len(f)); for idx, v := range f { r[idx] = _atoi(v) }; return r }()`;
    case "double[]":
      return `func() []float64 { f := strings.Fields(${lineVar}); r := make([]float64, len(f)); for idx, v := range f { r[idx] = _atof(v) }; return r }()`;
    case "boolean[]":
      return `func() []bool { f := strings.Fields(${lineVar}); r := make([]bool, len(f)); for idx, v := range f { r[idx] = v == "true" }; return r }()`;
    case "string[]":
      return `func() []string { if strings.TrimSpace(${lineVar}) == "" { return []string{} }; return strings.Split(${lineVar}, ",") }()`;
    case "int[][]":
      return `func() [][]int { if strings.TrimSpace(${lineVar}) == "" { return [][]int{} }; rows := strings.Split(${lineVar}, ";"); r := make([][]int, len(rows)); for ri, row := range rows { vals := strings.Split(row, ","); rv := make([]int, len(vals)); for vi, v := range vals { rv[vi] = _atoi(v) }; r[ri] = rv }; return r }()`;
    case "ListNode":
      return `_parseListNode(${lineVar})`;
    case "TreeNode":
      return `_parseTreeNode(${lineVar})`;
  }
}

function serializeExpr(type: ParamType, varName: string): string {
  switch (type) {
    case "int":
      return `strconv.Itoa(${varName})`;
    case "double":
      return `_fmtDouble(${varName})`;
    case "boolean":
      return `func() string { if ${varName} { return "true" }; return "false" }()`;
    case "string":
      return varName;
    case "int[]":
      return `func() string { s := make([]string, len(${varName})); for idx, v := range ${varName} { s[idx] = strconv.Itoa(v) }; return strings.Join(s, " ") }()`;
    case "double[]":
      return `func() string { s := make([]string, len(${varName})); for idx, v := range ${varName} { s[idx] = _fmtDouble(v) }; return strings.Join(s, " ") }()`;
    case "boolean[]":
      return `func() string { s := make([]string, len(${varName})); for idx, v := range ${varName} { if v { s[idx] = "true" } else { s[idx] = "false" } }; return strings.Join(s, " ") }()`;
    case "string[]":
      return `strings.Join(${varName}, ",")`;
    case "int[][]":
      return `func() string { rows := make([]string, len(${varName})); for ri, row := range ${varName} { vals := make([]string, len(row)); for vi, v := range row { vals[vi] = strconv.Itoa(v) }; rows[ri] = strings.Join(vals, ",") }; return strings.Join(rows, ";") }()`;
    case "ListNode":
      return `_serializeListNode(${varName})`;
    case "TreeNode":
      return `_serializeTreeNode(${varName})`;
  }
}

function goType(type: ParamType): string {
  switch (type) {
    case "int":
      return "int";
    case "double":
      return "float64";
    case "boolean":
      return "bool";
    case "string":
      return "string";
    case "int[]":
      return "[]int";
    case "double[]":
      return "[]float64";
    case "boolean[]":
      return "[]bool";
    case "string[]":
      return "[]string";
    case "int[][]":
      return "[][]int";
    case "ListNode":
      return "*ListNode";
    case "TreeNode":
      return "*TreeNode";
  }
}

export const goCodegen: LanguageCodegen = {
  starterTemplate(sig: FunctionSignature) {
    const params = sig.params.map((p) => `${p.name} ${goType(p.type)}`).join(", ");
    return `func ${sig.functionName}(${params}) ${goType(sig.returnType)} {\n\t// your code here\n\treturn ${zeroValue(sig.returnType)}\n}\n`;
  },

  wrapForExecution(sig: FunctionSignature, studentCode: string) {
    const lines: string[] = [
      "package main",
      "",
      'import (',
      '\t"bufio"',
      '\t"fmt"',
      '\t"os"',
      '\t"strconv"',
      '\t"strings"',
      ")",
      "",
      PREAMBLE,
      "",
      studentCode.trimEnd(),
      "",
      "func main() {",
      "\treader := bufio.NewReader(os.Stdin)",
      "\tvar _lines []string",
      "\tfor {",
      "\t\tline, err := reader.ReadString('\\n')",
      '\t\tline = strings.TrimRight(line, "\\r\\n")',
      "\t\t_lines = append(_lines, line)",
      "\t\tif err != nil {",
      "\t\t\tbreak",
      "\t\t}",
      "\t}",
    ];
    sig.params.forEach((p, i) => {
      lines.push(`\t${p.name} := ${parseExpr(p.type, `_lines[${i}]`)}`);
    });
    const argList = sig.params.map((p) => p.name).join(", ");
    lines.push(`\t_result := ${sig.functionName}(${argList})`);
    lines.push(`\tfmt.Println(${serializeExpr(sig.returnType, "_result")})`);
    lines.push("}");
    return lines.join("\n");
  },
};

function zeroValue(type: ParamType): string {
  switch (type) {
    case "int":
      return "0";
    case "double":
      return "0";
    case "boolean":
      return "false";
    case "string":
      return '""';
    case "int[]":
    case "double[]":
    case "boolean[]":
    case "string[]":
    case "int[][]":
      return "nil";
    case "ListNode":
    case "TreeNode":
      return "nil";
  }
}
