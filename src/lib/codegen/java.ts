import type { FunctionSignature, ParamType } from "@/lib/functionSignature";
import type { LanguageCodegen } from "./types";

// Only one top-level class may be `public` in a Java file — Main holds
// main() (Piston's Java source file is Main.java), Solution (the student's
// code) and the helper classes stay package-private in the same file.
const PREAMBLE = `
class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}

class _Helpers {
    static int[] parseIntArray(String line) {
        line = line.trim();
        if (line.isEmpty()) return new int[0];
        String[] parts = line.split("\\\\s+");
        int[] r = new int[parts.length];
        for (int i = 0; i < parts.length; i++) r[i] = Integer.parseInt(parts[i]);
        return r;
    }

    static double[] parseDoubleArray(String line) {
        line = line.trim();
        if (line.isEmpty()) return new double[0];
        String[] parts = line.split("\\\\s+");
        double[] r = new double[parts.length];
        for (int i = 0; i < parts.length; i++) r[i] = Double.parseDouble(parts[i]);
        return r;
    }

    static boolean[] parseBoolArray(String line) {
        line = line.trim();
        if (line.isEmpty()) return new boolean[0];
        String[] parts = line.split("\\\\s+");
        boolean[] r = new boolean[parts.length];
        for (int i = 0; i < parts.length; i++) r[i] = parts[i].equals("true");
        return r;
    }

    static String[] parseStringArray(String line) {
        if (line.isEmpty()) return new String[0];
        return line.split(",", -1);
    }

    static int[][] parseIntMatrix(String line) {
        line = line.trim();
        if (line.isEmpty()) return new int[0][0];
        String[] rows = line.split(";");
        int[][] r = new int[rows.length][];
        for (int i = 0; i < rows.length; i++) {
            String[] vals = rows[i].split(",");
            r[i] = new int[vals.length];
            for (int j = 0; j < vals.length; j++) r[i][j] = Integer.parseInt(vals[j]);
        }
        return r;
    }

    static ListNode parseListNode(String line) {
        int[] vals = parseIntArray(line);
        ListNode head = null, tail = null;
        for (int v : vals) {
            ListNode node = new ListNode(v);
            if (head == null) head = node; else tail.next = node;
            tail = node;
        }
        return head;
    }

    static String serializeListNode(ListNode node) {
        java.util.List<String> vals = new java.util.ArrayList<>();
        while (node != null) { vals.add(String.valueOf(node.val)); node = node.next; }
        return String.join(" ", vals);
    }

    static TreeNode parseTreeNode(String line) {
        line = line.trim();
        if (line.isEmpty()) return null;
        String[] tokens = line.split("\\\\s+");
        if (tokens.length == 0 || tokens[0].equals("#")) return null;
        TreeNode root = new TreeNode(Integer.parseInt(tokens[0]));
        java.util.Deque<TreeNode> queue = new java.util.ArrayDeque<>();
        queue.add(root);
        int i = 1;
        while (!queue.isEmpty() && i < tokens.length) {
            TreeNode node = queue.poll();
            if (i < tokens.length) {
                if (!tokens[i].equals("#")) {
                    node.left = new TreeNode(Integer.parseInt(tokens[i]));
                    queue.add(node.left);
                }
                i++;
            }
            if (i < tokens.length) {
                if (!tokens[i].equals("#")) {
                    node.right = new TreeNode(Integer.parseInt(tokens[i]));
                    queue.add(node.right);
                }
                i++;
            }
        }
        return root;
    }

    static String serializeTreeNode(TreeNode root) {
        if (root == null) return "#";
        java.util.List<String> result = new java.util.ArrayList<>();
        result.add(String.valueOf(root.val));
        java.util.Deque<TreeNode> queue = new java.util.ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();
            if (node.left != null) { result.add(String.valueOf(node.left.val)); queue.add(node.left); } else result.add("#");
            if (node.right != null) { result.add(String.valueOf(node.right.val)); queue.add(node.right); } else result.add("#");
        }
        while (!result.isEmpty() && result.get(result.size() - 1).equals("#")) result.remove(result.size() - 1);
        return String.join(" ", result);
    }

    static String fmtDouble(double d) {
        String s = String.format("%.6f", d);
        s = s.replaceAll("0+$", "");
        s = s.replaceAll("\\\\.$", "");
        if (s.isEmpty()) s = "0";
        return s;
    }

    static String joinIntArray(int[] a) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(" "); sb.append(a[i]); }
        return sb.toString();
    }

    static String joinDoubleArray(double[] a) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(" "); sb.append(fmtDouble(a[i])); }
        return sb.toString();
    }

    static String joinBoolArray(boolean[] a) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(" "); sb.append(a[i] ? "true" : "false"); }
        return sb.toString();
    }

    static String joinIntMatrix(int[][] m) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < m.length; i++) {
            if (i > 0) sb.append(";");
            for (int j = 0; j < m[i].length; j++) { if (j > 0) sb.append(","); sb.append(m[i][j]); }
        }
        return sb.toString();
    }
}
`.trim();

function javaType(type: ParamType): string {
  switch (type) {
    case "int":
      return "int";
    case "double":
      return "double";
    case "boolean":
      return "boolean";
    case "string":
      return "String";
    case "int[]":
      return "int[]";
    case "double[]":
      return "double[]";
    case "boolean[]":
      return "boolean[]";
    case "string[]":
      return "String[]";
    case "int[][]":
      return "int[][]";
    case "ListNode":
      return "ListNode";
    case "TreeNode":
      return "TreeNode";
  }
}

function parseExpr(type: ParamType, lineVar: string): string {
  switch (type) {
    case "int":
      return `Integer.parseInt(${lineVar})`;
    case "double":
      return `Double.parseDouble(${lineVar})`;
    case "boolean":
      return `${lineVar}.trim().equals("true")`;
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
      return `String.valueOf(${varName})`;
    case "double":
      return `_Helpers.fmtDouble(${varName})`;
    case "boolean":
      return `(${varName} ? "true" : "false")`;
    case "string":
      return varName;
    case "int[]":
      return `_Helpers.joinIntArray(${varName})`;
    case "double[]":
      return `_Helpers.joinDoubleArray(${varName})`;
    case "boolean[]":
      return `_Helpers.joinBoolArray(${varName})`;
    case "string[]":
      return `String.join(",", ${varName})`;
    case "int[][]":
      return `_Helpers.joinIntMatrix(${varName})`;
    case "ListNode":
      return `_Helpers.serializeListNode(${varName})`;
    case "TreeNode":
      return `_Helpers.serializeTreeNode(${varName})`;
  }
}

export const javaCodegen: LanguageCodegen = {
  starterTemplate(sig: FunctionSignature) {
    const params = sig.params.map((p) => `${javaType(p.type)} ${p.name}`).join(", ");
    return `class Solution {\n    public ${javaType(sig.returnType)} ${sig.functionName}(${params}) {\n        // your code here\n        return ${defaultValue(sig.returnType)};\n    }\n}\n`;
  },

  wrapForExecution(sig: FunctionSignature, studentCode: string) {
    // `Main` must be the first top-level class declared in the file: Piston's
    // `java` single-file source-launcher (JEP 330) runs whichever class comes first,
    // not the one literally named `Main` — forward references to Solution/PREAMBLE
    // classes declared later in the same file are fine in Java.
    const lines: string[] = [
      "import java.util.*;",
      "import java.io.*;",
      "",
      "public class Main {",
      "    public static void main(String[] args) throws Exception {",
      "        BufferedReader _br = new BufferedReader(new InputStreamReader(System.in));",
      `        String[] _lines = new String[${sig.params.length}];`,
      `        for (int _i = 0; _i < ${sig.params.length}; _i++) _lines[_i] = _br.readLine();`,
    ];
    sig.params.forEach((p, i) => {
      lines.push(`        ${javaType(p.type)} ${p.name} = ${parseExpr(p.type, `_lines[${i}]`)};`);
    });
    const argList = sig.params.map((p) => p.name).join(", ");
    lines.push("        Solution _sol = new Solution();");
    lines.push(`        ${javaType(sig.returnType)} _result = _sol.${sig.functionName}(${argList});`);
    lines.push(`        System.out.println(${serializeExpr(sig.returnType, "_result")});`);
    lines.push("    }", "}");
    lines.push("", PREAMBLE, "", studentCode.trimEnd());
    return lines.join("\n");
  },
};

function defaultValue(type: ParamType): string {
  switch (type) {
    case "int":
      return "0";
    case "double":
      return "0";
    case "boolean":
      return "false";
    case "string":
      return "null";
    default:
      return "null";
  }
}
