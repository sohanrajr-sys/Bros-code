import type { FunctionSignature, ParamType } from "@/lib/functionSignature";
import type { LanguageCodegen } from "./types";

const PREAMBLE = `
class ListNode(var value: Int, var next: ListNode = null)
class TreeNode(var value: Int, var left: TreeNode = null, var right: TreeNode = null)

object _Helpers {
  def parseIntArray(line: String): Array[Int] = {
    val t = line.trim
    if (t.isEmpty) Array() else t.split("\\\\s+").map(_.toInt)
  }
  def parseDoubleArray(line: String): Array[Double] = {
    val t = line.trim
    if (t.isEmpty) Array() else t.split("\\\\s+").map(_.toDouble)
  }
  def parseBoolArray(line: String): Array[Boolean] = {
    val t = line.trim
    if (t.isEmpty) Array() else t.split("\\\\s+").map(_ == "true")
  }
  def parseStringArray(line: String): Array[String] = {
    if (line.isEmpty) Array() else line.split(",", -1)
  }
  def parseIntMatrix(line: String): Array[Array[Int]] = {
    val t = line.trim
    if (t.isEmpty) Array() else t.split(";").map(row => row.split(",").map(_.toInt))
  }
  def parseListNode(line: String): ListNode = {
    val vals = parseIntArray(line)
    var head: ListNode = null
    var tail: ListNode = null
    for (v <- vals) {
      val node = new ListNode(v)
      if (head == null) head = node else tail.next = node
      tail = node
    }
    head
  }
  def serializeListNode(nodeIn: ListNode): String = {
    var node = nodeIn
    val vals = scala.collection.mutable.ArrayBuffer[String]()
    while (node != null) { vals += node.value.toString; node = node.next }
    vals.mkString(" ")
  }
  def parseTreeNode(line: String): TreeNode = {
    val t = line.trim
    if (t.isEmpty) return null
    val tokens = t.split("\\\\s+")
    if (tokens.isEmpty || tokens(0) == "#") return null
    val root = new TreeNode(tokens(0).toInt)
    val queue = scala.collection.mutable.Queue[TreeNode](root)
    var i = 1
    while (queue.nonEmpty && i < tokens.length) {
      val node = queue.dequeue()
      if (i < tokens.length) {
        if (tokens(i) != "#") {
          node.left = new TreeNode(tokens(i).toInt)
          queue.enqueue(node.left)
        }
        i += 1
      }
      if (i < tokens.length) {
        if (tokens(i) != "#") {
          node.right = new TreeNode(tokens(i).toInt)
          queue.enqueue(node.right)
        }
        i += 1
      }
    }
    root
  }
  def serializeTreeNode(rootIn: TreeNode): String = {
    if (rootIn == null) return "#"
    val result = scala.collection.mutable.ArrayBuffer[String](rootIn.value.toString)
    val queue = scala.collection.mutable.Queue[TreeNode](rootIn)
    while (queue.nonEmpty) {
      val node = queue.dequeue()
      if (node.left != null) { result += node.left.value.toString; queue.enqueue(node.left) } else result += "#"
      if (node.right != null) { result += node.right.value.toString; queue.enqueue(node.right) } else result += "#"
    }
    while (result.nonEmpty && result.last == "#") result.remove(result.length - 1)
    result.mkString(" ")
  }
  def fmtDouble(d: Double): String = {
    var s = f"$d%.6f"
    s = s.reverse.dropWhile(_ == '0').reverse
    if (s.endsWith(".")) s = s.dropRight(1)
    if (s.isEmpty) s = "0"
    s
  }
  def joinIntArray(a: Array[Int]): String = a.mkString(" ")
  def joinDoubleArray(a: Array[Double]): String = a.map(fmtDouble).mkString(" ")
  def joinBoolArray(a: Array[Boolean]): String = a.map(v => if (v) "true" else "false").mkString(" ")
  def joinIntMatrix(m: Array[Array[Int]]): String = m.map(row => row.mkString(",")).mkString(";")
}
`.trim();

function scalaType(type: ParamType): string {
  switch (type) {
    case "int":
      return "Int";
    case "double":
      return "Double";
    case "boolean":
      return "Boolean";
    case "string":
      return "String";
    case "int[]":
      return "Array[Int]";
    case "double[]":
      return "Array[Double]";
    case "boolean[]":
      return "Array[Boolean]";
    case "string[]":
      return "Array[String]";
    case "int[][]":
      return "Array[Array[Int]]";
    case "ListNode":
      return "ListNode";
    case "TreeNode":
      return "TreeNode";
  }
}

function parseExpr(type: ParamType, lineVar: string): string {
  switch (type) {
    case "int":
      return `${lineVar}.trim.toInt`;
    case "double":
      return `${lineVar}.trim.toDouble`;
    case "boolean":
      return `${lineVar}.trim == "true"`;
    case "string":
      return lineVar;
    case "int[]":
      return `_Helpers.parseIntArray(${lineVar})`;
    case "double[]":
      return `_Helpers.parseDoubleArray(${lineVar})`;
    case "boolean[]":
      return `_Helpers.parseBoolArray(${lineVar})`;
    case "string[]":
      return `_Helpers.parseStringArray(${lineVar})`;
    case "int[][]":
      return `_Helpers.parseIntMatrix(${lineVar})`;
    case "ListNode":
      return `_Helpers.parseListNode(${lineVar})`;
    case "TreeNode":
      return `_Helpers.parseTreeNode(${lineVar})`;
  }
}

function serializeExpr(type: ParamType, varName: string): string {
  switch (type) {
    case "int":
      return `${varName}.toString`;
    case "double":
      return `_Helpers.fmtDouble(${varName})`;
    case "boolean":
      return `(if (${varName}) "true" else "false")`;
    case "string":
      return varName;
    case "int[]":
      return `_Helpers.joinIntArray(${varName})`;
    case "double[]":
      return `_Helpers.joinDoubleArray(${varName})`;
    case "boolean[]":
      return `_Helpers.joinBoolArray(${varName})`;
    case "string[]":
      return `${varName}.mkString(",")`;
    case "int[][]":
      return `_Helpers.joinIntMatrix(${varName})`;
    case "ListNode":
      return `_Helpers.serializeListNode(${varName})`;
    case "TreeNode":
      return `_Helpers.serializeTreeNode(${varName})`;
  }
}

export const scalaCodegen: LanguageCodegen = {
  starterTemplate(sig: FunctionSignature) {
    const params = sig.params.map((p) => `${p.name}: ${scalaType(p.type)}`).join(", ");
    return `object Solution {\n  def ${sig.functionName}(${params}): ${scalaType(sig.returnType)} = {\n    // your code here\n    ???\n  }\n}\n`;
  },

  wrapForExecution(sig: FunctionSignature, studentCode: string) {
    const lines: string[] = [PREAMBLE, "", studentCode.trimEnd(), "", "object Main {", "  def main(args: Array[String]): Unit = {", `    val _lines = new Array[String](${sig.params.length})`, `    for (_i <- 0 until ${sig.params.length}) _lines(_i) = scala.io.StdIn.readLine()`];
    sig.params.forEach((p, i) => {
      lines.push(`    val ${p.name}: ${scalaType(p.type)} = ${parseExpr(p.type, `_lines(${i})`)}`);
    });
    const argList = sig.params.map((p) => p.name).join(", ");
    lines.push(`    val _result = Solution.${sig.functionName}(${argList})`);
    lines.push(`    println(${serializeExpr(sig.returnType, "_result")})`);
    lines.push("  }", "}");
    return lines.join("\n");
  },
};
