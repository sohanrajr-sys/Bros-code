import type { Language } from "@/generated/prisma/enums";

export const DSA_LANGUAGES: Language[] = ["PYTHON", "CPP", "JAVA", "C", "GO", "SCALA"];

export const LANGUAGE_LABELS: Record<Language, string> = {
  C: "C",
  CPP: "C++",
  JAVA: "Java",
  PYTHON: "Python",
  GO: "Go",
  SCALA: "Scala",
  SQL: "SQL",
};

export const MONACO_LANGUAGE_IDS: Record<Language, string> = {
  C: "c",
  CPP: "cpp",
  JAVA: "java",
  PYTHON: "python",
  GO: "go",
  SCALA: "scala",
  SQL: "sql",
};

export const STARTER_CODE: Record<Language, string> = {
  PYTHON: "import sys\n\ndef main():\n    data = sys.stdin.read().split()\n    # write your solution here\n\nif __name__ == \"__main__\":\n    main()\n",
  CPP: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // write your solution here\n    return 0;\n}\n",
  JAVA: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // write your solution here\n    }\n}\n",
  C: "#include <stdio.h>\n\nint main() {\n    // write your solution here\n    return 0;\n}\n",
  GO: "package main\n\nimport (\n    \"bufio\"\n    \"fmt\"\n    \"os\"\n)\n\nfunc main() {\n    reader := bufio.NewReader(os.Stdin)\n    _ = reader\n    fmt.Println()\n    // write your solution here\n}\n",
  SCALA: "import scala.io.StdIn._\n\nobject Main extends App {\n  // write your solution here\n}\n",
  SQL: "-- write your query here\nSELECT\n",
};
