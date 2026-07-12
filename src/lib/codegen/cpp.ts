import type { FunctionSignature, ParamType } from "@/lib/functionSignature";
import type { LanguageCodegen } from "./types";

const PREAMBLE = `
struct ListNode {
    int val;
    ListNode *next;
    ListNode(int x) : val(x), next(nullptr) {}
};

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

vector<string> _splitWs(const string &s) {
    vector<string> out;
    stringstream ss(s);
    string tok;
    while (ss >> tok) out.push_back(tok);
    return out;
}

vector<string> _splitDelim(const string &s, char delim) {
    vector<string> out;
    if (s.empty()) return out;
    stringstream ss(s);
    string tok;
    while (getline(ss, tok, delim)) out.push_back(tok);
    return out;
}

string _join(const vector<string> &parts, const string &delim) {
    string out;
    for (size_t i = 0; i < parts.size(); i++) {
        if (i) out += delim;
        out += parts[i];
    }
    return out;
}

string _fmtDouble(double d) {
    char buf[64];
    snprintf(buf, sizeof(buf), "%.6f", d);
    string s(buf);
    while (!s.empty() && s.back() == '0') s.pop_back();
    if (!s.empty() && s.back() == '.') s.pop_back();
    return s.empty() ? "0" : s;
}

ListNode* _parseListNode(const string &line) {
    auto parts = _splitWs(line);
    if (parts.empty()) return nullptr;
    ListNode* head = new ListNode(stoi(parts[0]));
    ListNode* cur = head;
    for (size_t i = 1; i < parts.size(); i++) {
        cur->next = new ListNode(stoi(parts[i]));
        cur = cur->next;
    }
    return head;
}

string _serializeListNode(ListNode* node) {
    vector<string> vals;
    while (node) {
        vals.push_back(to_string(node->val));
        node = node->next;
    }
    return _join(vals, " ");
}

TreeNode* _parseTreeNode(const string &line) {
    auto tokens = _splitWs(line);
    if (tokens.empty() || tokens[0] == "#") return nullptr;
    TreeNode* root = new TreeNode(stoi(tokens[0]));
    deque<TreeNode*> q;
    q.push_back(root);
    size_t i = 1;
    while (!q.empty() && i < tokens.size()) {
        TreeNode* node = q.front(); q.pop_front();
        if (i < tokens.size()) {
            if (tokens[i] != "#") { node->left = new TreeNode(stoi(tokens[i])); q.push_back(node->left); }
            i++;
        }
        if (i < tokens.size()) {
            if (tokens[i] != "#") { node->right = new TreeNode(stoi(tokens[i])); q.push_back(node->right); }
            i++;
        }
    }
    return root;
}

string _serializeTreeNode(TreeNode* root) {
    if (!root) return "#";
    vector<string> result;
    result.push_back(to_string(root->val));
    deque<TreeNode*> q;
    q.push_back(root);
    while (!q.empty()) {
        TreeNode* node = q.front(); q.pop_front();
        if (node->left) { result.push_back(to_string(node->left->val)); q.push_back(node->left); }
        else result.push_back("#");
        if (node->right) { result.push_back(to_string(node->right->val)); q.push_back(node->right); }
        else result.push_back("#");
    }
    while (!result.empty() && result.back() == "#") result.pop_back();
    return _join(result, " ");
}
`.trim();

function parseExpr(type: ParamType, lineVar: string): string {
  switch (type) {
    case "int":
      return `stoi(${lineVar})`;
    case "double":
      return `stod(${lineVar})`;
    case "boolean":
      return `(${lineVar} == "true")`;
    case "string":
      return lineVar;
    case "int[]":
      return `[&]{ vector<int> r; for (auto &t : _splitWs(${lineVar})) r.push_back(stoi(t)); return r; }()`;
    case "double[]":
      return `[&]{ vector<double> r; for (auto &t : _splitWs(${lineVar})) r.push_back(stod(t)); return r; }()`;
    case "boolean[]":
      return `[&]{ vector<bool> r; for (auto &t : _splitWs(${lineVar})) r.push_back(t == "true"); return r; }()`;
    case "string[]":
      return `_splitDelim(${lineVar}, ',')`;
    case "int[][]":
      return `[&]{ vector<vector<int>> r; for (auto &row : _splitDelim(${lineVar}, ';')) { vector<int> rv; for (auto &v : _splitDelim(row, ',')) rv.push_back(stoi(v)); r.push_back(rv); } return r; }()`;
    case "ListNode":
      return `_parseListNode(${lineVar})`;
    case "TreeNode":
      return `_parseTreeNode(${lineVar})`;
  }
}

function serializeExpr(type: ParamType, varName: string): string {
  switch (type) {
    case "int":
      return `to_string(${varName})`;
    case "double":
      return `_fmtDouble(${varName})`;
    case "boolean":
      return `(${varName} ? string("true") : string("false"))`;
    case "string":
      return varName;
    case "int[]":
      return `[&]{ vector<string> s; for (auto &v : ${varName}) s.push_back(to_string(v)); return _join(s, " "); }()`;
    case "double[]":
      return `[&]{ vector<string> s; for (auto &v : ${varName}) s.push_back(_fmtDouble(v)); return _join(s, " "); }()`;
    case "boolean[]":
      return `[&]{ vector<string> s; for (auto v : ${varName}) s.push_back(v ? "true" : "false"); return _join(s, " "); }()`;
    case "string[]":
      return `_join(${varName}, ",")`;
    case "int[][]":
      return `[&]{ vector<string> rows; for (auto &row : ${varName}) { vector<string> vals; for (auto &v : row) vals.push_back(to_string(v)); rows.push_back(_join(vals, ",")); } return _join(rows, ";"); }()`;
    case "ListNode":
      return `_serializeListNode(${varName})`;
    case "TreeNode":
      return `_serializeTreeNode(${varName})`;
  }
}

function cppType(type: ParamType): string {
  switch (type) {
    case "int":
      return "int";
    case "double":
      return "double";
    case "boolean":
      return "bool";
    case "string":
      return "string";
    case "int[]":
      return "vector<int>";
    case "double[]":
      return "vector<double>";
    case "boolean[]":
      return "vector<bool>";
    case "string[]":
      return "vector<string>";
    case "int[][]":
      return "vector<vector<int>>";
    case "ListNode":
      return "ListNode*";
    case "TreeNode":
      return "TreeNode*";
  }
}

export const cppCodegen: LanguageCodegen = {
  starterTemplate(sig: FunctionSignature) {
    const params = sig.params.map((p) => `${cppType(p.type)} ${p.name}`).join(", ");
    return `${cppType(sig.returnType)} ${sig.functionName}(${params}) {\n    // your code here\n}\n`;
  },

  wrapForExecution(sig: FunctionSignature, studentCode: string) {
    const lines: string[] = [
      "#include <iostream>",
      "#include <sstream>",
      "#include <string>",
      "#include <vector>",
      "#include <deque>",
      "#include <unordered_map>",
      "#include <map>",
      "#include <algorithm>",
      "using namespace std;",
      "",
      PREAMBLE,
      "",
      studentCode.trimEnd(),
      "",
      "int main() {",
      "    vector<string> _lines;",
      "    string _line;",
      "    while (getline(cin, _line)) _lines.push_back(_line);",
    ];
    sig.params.forEach((p, i) => {
      lines.push(`    ${cppType(p.type)} ${p.name} = ${parseExpr(p.type, `_lines[${i}]`)};`);
    });
    const argList = sig.params.map((p) => p.name).join(", ");
    lines.push(`    ${cppType(sig.returnType)} _result = ${sig.functionName}(${argList});`);
    lines.push(`    cout << ${serializeExpr(sig.returnType, "_result")} << endl;`);
    lines.push("    return 0;", "}");
    return lines.join("\n");
  },
};
