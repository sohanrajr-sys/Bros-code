import type { FunctionSignature, FunctionParam, ParamType } from "@/lib/functionSignature";
import type { LanguageCodegen } from "./types";

// C has no dynamic arrays: array-typed params/returns follow LeetCode's own C
// convention — an array param becomes `T* name, int nameSize` (two C params),
// and an array return type becomes `T* fn(..., int* returnSize)` (an extra
// out-param the student's implementation must fill in with the result length).
// int[][] needs a third param, `int* nameColSize` (per-row column counts),
// matching LeetCode's real int** convention.

const PREAMBLE = `
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

struct ListNode {
    int val;
    struct ListNode *next;
};

struct TreeNode {
    int val;
    struct TreeNode *left;
    struct TreeNode *right;
};

char* _readLine(void) {
    char *line = NULL;
    size_t cap = 0;
    ssize_t len = getline(&line, &cap, stdin);
    if (len < 0) {
        if (line) free(line);
        line = malloc(1);
        line[0] = '\\0';
        return line;
    }
    while (len > 0 && (line[len - 1] == '\\n' || line[len - 1] == '\\r')) {
        line[--len] = '\\0';
    }
    return line;
}

int _parseInt(const char *s) { return atoi(s); }
double _parseDouble(const char *s) { return atof(s); }
bool _parseBool(const char *s) { return strcmp(s, "true") == 0; }

int* _parseIntArray(const char *line, int *outSize) {
    int cap = 16, n = 0;
    int *arr = malloc(cap * sizeof(int));
    char *copy = strdup(line);
    char *tok = strtok(copy, " ");
    while (tok) {
        if (n >= cap) { cap *= 2; arr = realloc(arr, cap * sizeof(int)); }
        arr[n++] = atoi(tok);
        tok = strtok(NULL, " ");
    }
    free(copy);
    *outSize = n;
    return arr;
}

double* _parseDoubleArray(const char *line, int *outSize) {
    int cap = 16, n = 0;
    double *arr = malloc(cap * sizeof(double));
    char *copy = strdup(line);
    char *tok = strtok(copy, " ");
    while (tok) {
        if (n >= cap) { cap *= 2; arr = realloc(arr, cap * sizeof(double)); }
        arr[n++] = atof(tok);
        tok = strtok(NULL, " ");
    }
    free(copy);
    *outSize = n;
    return arr;
}

bool* _parseBoolArray(const char *line, int *outSize) {
    int cap = 16, n = 0;
    bool *arr = malloc(cap * sizeof(bool));
    char *copy = strdup(line);
    char *tok = strtok(copy, " ");
    while (tok) {
        if (n >= cap) { cap *= 2; arr = realloc(arr, cap * sizeof(bool)); }
        arr[n++] = strcmp(tok, "true") == 0;
        tok = strtok(NULL, " ");
    }
    free(copy);
    *outSize = n;
    return arr;
}

char** _parseStringArray(const char *line, int *outSize) {
    int cap = 16, n = 0;
    char **arr = malloc(cap * sizeof(char*));
    if (strlen(line) == 0) { *outSize = 0; return arr; }
    char *copy = strdup(line);
    char *tok = strtok(copy, ",");
    while (tok) {
        if (n >= cap) { cap *= 2; arr = realloc(arr, cap * sizeof(char*)); }
        arr[n++] = strdup(tok);
        tok = strtok(NULL, ",");
    }
    free(copy);
    *outSize = n;
    return arr;
}

int** _parseIntMatrix(const char *line, int *outRows, int **outColSizes) {
    int rowCap = 8, rows = 0;
    int **mat = malloc(rowCap * sizeof(int*));
    int *colSizes = malloc(rowCap * sizeof(int));
    if (strlen(line) == 0) { *outRows = 0; *outColSizes = colSizes; return mat; }
    char *copy = strdup(line);
    char *rowSave = NULL;
    char *rowTok = strtok_r(copy, ";", &rowSave);
    while (rowTok) {
        if (rows >= rowCap) { rowCap *= 2; mat = realloc(mat, rowCap * sizeof(int*)); colSizes = realloc(colSizes, rowCap * sizeof(int)); }
        int cap = 8, n = 0;
        int *row = malloc(cap * sizeof(int));
        char *rowCopy = strdup(rowTok);
        char *valSave = NULL;
        char *valTok = strtok_r(rowCopy, ",", &valSave);
        while (valTok) {
            if (n >= cap) { cap *= 2; row = realloc(row, cap * sizeof(int)); }
            row[n++] = atoi(valTok);
            valTok = strtok_r(NULL, ",", &valSave);
        }
        free(rowCopy);
        mat[rows] = row;
        colSizes[rows] = n;
        rows++;
        rowTok = strtok_r(NULL, ";", &rowSave);
    }
    free(copy);
    *outRows = rows;
    *outColSizes = colSizes;
    return mat;
}

struct ListNode* _parseListNode(const char *line) {
    int size;
    int *vals = _parseIntArray(line, &size);
    struct ListNode *head = NULL, *tail = NULL;
    for (int i = 0; i < size; i++) {
        struct ListNode *node = malloc(sizeof(struct ListNode));
        node->val = vals[i];
        node->next = NULL;
        if (!head) head = node; else tail->next = node;
        tail = node;
    }
    free(vals);
    return head;
}

char* _serializeListNode(struct ListNode *node) {
    char *buf = malloc(65536);
    buf[0] = '\\0';
    bool first = true;
    while (node) {
        char part[32];
        snprintf(part, sizeof(part), "%s%d", first ? "" : " ", node->val);
        strcat(buf, part);
        first = false;
        node = node->next;
    }
    return buf;
}

struct TreeNode* _parseTreeNode(const char *line) {
    int size;
    char *copy = strdup(line);
    int cap = 16, n = 0;
    char **tokens = malloc(cap * sizeof(char*));
    char *tok = strtok(copy, " ");
    while (tok) {
        if (n >= cap) { cap *= 2; tokens = realloc(tokens, cap * sizeof(char*)); }
        tokens[n++] = tok;
        tok = strtok(NULL, " ");
    }
    size = n;
    if (size == 0 || strcmp(tokens[0], "#") == 0) { free(tokens); free(copy); return NULL; }
    struct TreeNode *root = malloc(sizeof(struct TreeNode));
    root->val = atoi(tokens[0]);
    root->left = root->right = NULL;
    struct TreeNode **queue = malloc(size * sizeof(struct TreeNode*));
    int qHead = 0, qTail = 0;
    queue[qTail++] = root;
    int i = 1;
    while (qHead < qTail && i < size) {
        struct TreeNode *node = queue[qHead++];
        if (i < size) {
            if (strcmp(tokens[i], "#") != 0) {
                struct TreeNode *left = malloc(sizeof(struct TreeNode));
                left->val = atoi(tokens[i]);
                left->left = left->right = NULL;
                node->left = left;
                queue[qTail++] = left;
            }
            i++;
        }
        if (i < size) {
            if (strcmp(tokens[i], "#") != 0) {
                struct TreeNode *right = malloc(sizeof(struct TreeNode));
                right->val = atoi(tokens[i]);
                right->left = right->right = NULL;
                node->right = right;
                queue[qTail++] = right;
            }
            i++;
        }
    }
    free(queue);
    free(tokens);
    free(copy);
    return root;
}

char* _serializeTreeNode(struct TreeNode *root) {
    char *buf = malloc(65536);
    buf[0] = '\\0';
    if (!root) { strcpy(buf, "#"); return buf; }
    int cap = 1024, n = 0;
    char **result = malloc(cap * sizeof(char*));
    char rootBuf[32];
    snprintf(rootBuf, sizeof(rootBuf), "%d", root->val);
    result[n++] = strdup(rootBuf);
    struct TreeNode **queue = malloc(cap * sizeof(struct TreeNode*));
    int qHead = 0, qTail = 0;
    queue[qTail++] = root;
    while (qHead < qTail) {
        struct TreeNode *node = queue[qHead++];
        if (qTail + 2 >= cap) { cap *= 2; result = realloc(result, cap * sizeof(char*)); queue = realloc(queue, cap * sizeof(struct TreeNode*)); }
        if (node->left) {
            char b[32]; snprintf(b, sizeof(b), "%d", node->left->val);
            result[n++] = strdup(b);
            queue[qTail++] = node->left;
        } else {
            result[n++] = strdup("#");
        }
        if (node->right) {
            char b[32]; snprintf(b, sizeof(b), "%d", node->right->val);
            result[n++] = strdup(b);
            queue[qTail++] = node->right;
        } else {
            result[n++] = strdup("#");
        }
    }
    while (n > 0 && strcmp(result[n - 1], "#") == 0) n--;
    for (int i = 0; i < n; i++) {
        if (i) strcat(buf, " ");
        strcat(buf, result[i]);
    }
    free(result);
    free(queue);
    return buf;
}

char* _fmtInt(int v) { char *b = malloc(32); snprintf(b, 32, "%d", v); return b; }

char* _fmtDouble(double d) {
    char *b = malloc(64);
    snprintf(b, 64, "%.6f", d);
    int len = (int)strlen(b);
    while (len > 0 && b[len - 1] == '0') b[--len] = '\\0';
    if (len > 0 && b[len - 1] == '.') b[--len] = '\\0';
    if (len == 0) { b[0] = '0'; b[1] = '\\0'; }
    return b;
}

char* _fmtBool(bool v) { return strdup(v ? "true" : "false"); }

char* _fmtIntArray(int *arr, int n) {
    char *buf = malloc(65536);
    buf[0] = '\\0';
    for (int i = 0; i < n; i++) {
        char part[32];
        snprintf(part, sizeof(part), "%s%d", i ? " " : "", arr[i]);
        strcat(buf, part);
    }
    return buf;
}

char* _fmtDoubleArray(double *arr, int n) {
    char *buf = malloc(65536);
    buf[0] = '\\0';
    for (int i = 0; i < n; i++) {
        char *d = _fmtDouble(arr[i]);
        if (i) strcat(buf, " ");
        strcat(buf, d);
        free(d);
    }
    return buf;
}

char* _fmtBoolArray(bool *arr, int n) {
    char *buf = malloc(65536);
    buf[0] = '\\0';
    for (int i = 0; i < n; i++) {
        if (i) strcat(buf, " ");
        strcat(buf, arr[i] ? "true" : "false");
    }
    return buf;
}

char* _fmtStringArray(char **arr, int n) {
    char *buf = malloc(65536);
    buf[0] = '\\0';
    for (int i = 0; i < n; i++) {
        if (i) strcat(buf, ",");
        strcat(buf, arr[i]);
    }
    return buf;
}

char* _fmtIntMatrix(int **mat, int rows, int *colSizes) {
    char *buf = malloc(65536);
    buf[0] = '\\0';
    for (int r = 0; r < rows; r++) {
        if (r) strcat(buf, ";");
        for (int c = 0; c < colSizes[r]; c++) {
            char part[32];
            snprintf(part, sizeof(part), "%s%d", c ? "," : "", mat[r][c]);
            strcat(buf, part);
        }
    }
    return buf;
}
`.trim();

function scalarCType(type: "int" | "double" | "boolean" | "string"): string {
  switch (type) {
    case "int":
      return "int";
    case "double":
      return "double";
    case "boolean":
      return "bool";
    case "string":
      return "char*";
  }
}

/** How a param expands into actual C parameters (name, C type) — arrays need paired size params. */
function paramCDecls(p: FunctionParam): { name: string; cType: string }[] {
  switch (p.type) {
    case "int":
    case "double":
    case "boolean":
    case "string":
      return [{ name: p.name, cType: scalarCType(p.type) }];
    case "int[]":
      return [
        { name: p.name, cType: "int*" },
        { name: `${p.name}Size`, cType: "int" },
      ];
    case "double[]":
      return [
        { name: p.name, cType: "double*" },
        { name: `${p.name}Size`, cType: "int" },
      ];
    case "boolean[]":
      return [
        { name: p.name, cType: "bool*" },
        { name: `${p.name}Size`, cType: "int" },
      ];
    case "string[]":
      return [
        { name: p.name, cType: "char**" },
        { name: `${p.name}Size`, cType: "int" },
      ];
    case "int[][]":
      return [
        { name: p.name, cType: "int**" },
        { name: `${p.name}Size`, cType: "int" },
        { name: `${p.name}ColSize`, cType: "int*" },
      ];
    case "ListNode":
      return [{ name: p.name, cType: "struct ListNode*" }];
    case "TreeNode":
      return [{ name: p.name, cType: "struct TreeNode*" }];
  }
}

function parseStatements(p: FunctionParam, lineExpr: string): string[] {
  const n = p.name;
  switch (p.type) {
    case "int":
      return [`int ${n} = _parseInt(${lineExpr});`];
    case "double":
      return [`double ${n} = _parseDouble(${lineExpr});`];
    case "boolean":
      return [`bool ${n} = _parseBool(${lineExpr});`];
    case "string":
      return [`char* ${n} = ${lineExpr};`];
    case "int[]":
      return [`int ${n}Size; int* ${n} = _parseIntArray(${lineExpr}, &${n}Size);`];
    case "double[]":
      return [`int ${n}Size; double* ${n} = _parseDoubleArray(${lineExpr}, &${n}Size);`];
    case "boolean[]":
      return [`int ${n}Size; bool* ${n} = _parseBoolArray(${lineExpr}, &${n}Size);`];
    case "string[]":
      return [`int ${n}Size; char** ${n} = _parseStringArray(${lineExpr}, &${n}Size);`];
    case "int[][]":
      return [`int ${n}Size; int* ${n}ColSize; int** ${n} = _parseIntMatrix(${lineExpr}, &${n}Size, &${n}ColSize);`];
    case "ListNode":
      return [`struct ListNode* ${n} = _parseListNode(${lineExpr});`];
    case "TreeNode":
      return [`struct TreeNode* ${n} = _parseTreeNode(${lineExpr});`];
  }
}

function callArgs(p: FunctionParam): string[] {
  switch (p.type) {
    case "int[]":
    case "double[]":
    case "boolean[]":
    case "string[]":
      return [p.name, `${p.name}Size`];
    case "int[][]":
      return [p.name, `${p.name}Size`, `${p.name}ColSize`];
    default:
      return [p.name];
  }
}

function returnCType(type: ParamType): string {
  switch (type) {
    case "int[]":
      return "int*";
    case "double[]":
      return "double*";
    case "boolean[]":
      return "bool*";
    case "string[]":
      return "char**";
    case "int[][]":
      return "int**";
    default:
      return scalarOrNodeCType(type);
  }
}

function scalarOrNodeCType(type: ParamType): string {
  switch (type) {
    case "int":
      return "int";
    case "double":
      return "double";
    case "boolean":
      return "bool";
    case "string":
      return "char*";
    case "ListNode":
      return "struct ListNode*";
    case "TreeNode":
      return "struct TreeNode*";
    default:
      return "void*";
  }
}

/** Extra out-params appended to the signature for array return types (LeetCode's C convention). */
function returnOutParams(type: ParamType): { name: string; cType: string }[] {
  switch (type) {
    case "int[]":
    case "double[]":
    case "boolean[]":
    case "string[]":
      return [{ name: "returnSize", cType: "int*" }];
    case "int[][]":
      return [
        { name: "returnSize", cType: "int*" },
        { name: "returnColumnSizes", cType: "int**" },
      ];
    default:
      return [];
  }
}

function serializeReturnExpr(type: ParamType): string {
  switch (type) {
    case "int":
      return "_fmtInt(_result)";
    case "double":
      return "_fmtDouble(_result)";
    case "boolean":
      return "_fmtBool(_result)";
    case "string":
      return "_result";
    case "int[]":
      return "_fmtIntArray(_result, _returnSize)";
    case "double[]":
      return "_fmtDoubleArray(_result, _returnSize)";
    case "boolean[]":
      return "_fmtBoolArray(_result, _returnSize)";
    case "string[]":
      return "_fmtStringArray(_result, _returnSize)";
    case "int[][]":
      return "_fmtIntMatrix(_result, _returnSize, _returnColumnSizes)";
    case "ListNode":
      return "_serializeListNode(_result)";
    case "TreeNode":
      return "_serializeTreeNode(_result)";
  }
}

export const cCodegen: LanguageCodegen = {
  starterTemplate(sig: FunctionSignature) {
    const paramDecls = sig.params.flatMap(paramCDecls);
    const outParams = returnOutParams(sig.returnType);
    const allParams = [...paramDecls, ...outParams].map((d) => `${d.cType} ${d.name}`).join(", ");
    return `${returnCType(sig.returnType)} ${sig.functionName}(${allParams}) {\n    // your code here\n}\n`;
  },

  wrapForExecution(sig: FunctionSignature, studentCode: string) {
    const lines: string[] = [PREAMBLE, "", studentCode.trimEnd(), "", "int main() {"];

    lines.push(`    char* _lines[${sig.params.length}];`);
    sig.params.forEach((_p, i) => {
      lines.push(`    _lines[${i}] = _readLine();`);
    });
    sig.params.forEach((p, i) => {
      lines.push(`    ${parseStatements(p, `_lines[${i}]`).join(" ")}`);
    });

    const callArgList = [...sig.params.flatMap(callArgs)];
    const outParams = returnOutParams(sig.returnType);
    outParams.forEach((op) => {
      const decl = op.cType === "int**" ? "int*" : "int";
      lines.push(`    ${decl} _${op.name};`);
      callArgList.push(`&_${op.name}`);
    });

    lines.push(`    ${returnCType(sig.returnType)} _result = ${sig.functionName}(${callArgList.join(", ")});`);
    lines.push(`    printf("%s\\n", ${serializeReturnExpr(sig.returnType)});`);
    lines.push("    return 0;", "}");
    return lines.join("\n");
  },
};
