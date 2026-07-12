import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import type { Prisma } from "../src/generated/prisma/client";
import type { FunctionSignature } from "../src/lib/functionSignature";
import { hashPassword } from "../src/lib/password";

async function bootstrapAdmin(): Promise<{ id: string } | null> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin bootstrap.");
    return null;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${existing.email} (password left unchanged)`);
    return existing;
  }
  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.create({
    data: { email, passwordHash, role: "ADMIN", name: "Admin" },
  });
  console.log(`Bootstrapped admin: ${admin.email}`);
  return admin;
}

// Fixed-credential test student, unlike bootstrapAdmin this always resets the
// password on reseed — it exists purely so local dev has a known login to test with.
async function seedTestStudent(): Promise<void> {
  const studentId = "student1";
  const passwordHash = await hashPassword("password123");
  await prisma.user.upsert({
    where: { studentId },
    update: { passwordHash },
    create: { studentId, name: "Test Student", role: "STUDENT", passwordHash },
  });
  console.log(`Seeded test student: ${studentId}`);
}

// --- line-encoding helpers (mirror src/lib/codegen/*.ts's driver encoding) ---
function encInt(n: number): string {
  return String(n);
}
function encIntArray(a: number[]): string {
  return a.join(" ");
}
function encIntMatrix(m: number[][]): string {
  return m.map((r) => r.join(",")).join(";");
}
function encBool(b: boolean): string {
  return b ? "true" : "false";
}
function encDouble(d: number): string {
  let s = d.toFixed(6);
  s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s === "" ? "0" : s;
}
function encStringArray(a: string[]): string {
  return a.join(",");
}

interface TNode {
  val: number;
  left: TNode | null;
  right: TNode | null;
}
function buildTree(tokens: string[]): TNode | null {
  if (tokens.length === 0 || tokens[0] === "#") return null;
  const root: TNode = { val: Number(tokens[0]), left: null, right: null };
  const queue: TNode[] = [root];
  let i = 1;
  while (queue.length && i < tokens.length) {
    const node = queue.shift()!;
    if (i < tokens.length) {
      if (tokens[i] !== "#") {
        const left: TNode = { val: Number(tokens[i]), left: null, right: null };
        node.left = left;
        queue.push(left);
      }
      i++;
    }
    if (i < tokens.length) {
      if (tokens[i] !== "#") {
        const right: TNode = { val: Number(tokens[i]), left: null, right: null };
        node.right = right;
        queue.push(right);
      }
      i++;
    }
  }
  return root;
}
function inorder(node: TNode | null, out: number[] = []): number[] {
  if (!node) return out;
  inorder(node.left, out);
  out.push(node.val);
  inorder(node.right, out);
  return out;
}
function depth(node: TNode | null): number {
  if (!node) return 0;
  return 1 + Math.max(depth(node.left), depth(node.right));
}

/** Builds 17 test-case rows (first 2 shown, rest hidden) from raw inputs + encoders. */
function buildCases<T>(
  problemId: string,
  inputs: T[],
  toInput: (t: T) => string,
  toOutput: (t: T) => string
): Prisma.TestCaseCreateManyInput[] {
  return inputs.map((t, idx) => ({
    problemId,
    input: toInput(t),
    expectedOutput: toOutput(t),
    isHidden: idx >= 2,
    order: idx + 1,
  }));
}

async function main() {
  const seededSlugs: string[] = [];
  const admin = await bootstrapAdmin();
  await seedTestStudent();
  // Transitional fallback: falls back to the literal "seed-script" string only
  // if ADMIN_EMAIL/ADMIN_PASSWORD aren't set. Once the Problem/Submission FK
  // migration lands, ADMIN_EMAIL/ADMIN_PASSWORD must be set for seeding to work.
  const adminId = admin?.id ?? "seed-script";

  const twoSumSignature: FunctionSignature = {
    functionName: "twoSum",
    params: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returnType: "int[]",
  };

  const twoSumFields = {
    slug: "two-sum",
    title: "Two Sum",
    description:
      "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.\n\nEach input has exactly one solution, and you may not use the same element twice.",
    difficulty: "EASY" as const,
    tags: ["array", "hash-map"],
    type: "DSA" as const,
    constraints: "2 <= nums.length <= 10^4",
    functionSignature: twoSumSignature as unknown as Prisma.InputJsonValue,
    createdBy: adminId,
  };

  const twoSum = await prisma.problem.upsert({
    where: { slug: "two-sum" },
    update: twoSumFields,
    create: twoSumFields,
  });
  seededSlugs.push(twoSum.slug);

  await prisma.testCase.deleteMany({ where: { problemId: twoSum.id } });
  await prisma.testCase.createMany({
    data: [
      { problemId: twoSum.id, input: "2 7 11 15\n9", expectedOutput: "0 1", isHidden: false, order: 1 },
      { problemId: twoSum.id, input: "3 2 4\n6", expectedOutput: "1 2", isHidden: false, order: 2 },
      { problemId: twoSum.id, input: "3 3\n6", expectedOutput: "0 1", isHidden: true, order: 3 },
    ],
  });

  const activeUsersFields = {
    slug: "active-users-last-30-days",
    title: "Active Users in the Last 30 Days",
    description:
      "Given a `logins` table with columns `user_id` and `login_date`, write a query that returns the distinct `user_id`s who logged in within the last 30 days of the most recent login date in the table, ordered by `user_id` ascending.",
    difficulty: "MEDIUM" as const,
    tags: ["sql", "dates", "group-by"],
    type: "SQL" as const,
    constraints: null,
    createdBy: adminId,
  };

  const activeUsers = await prisma.problem.upsert({
    where: { slug: "active-users-last-30-days" },
    update: activeUsersFields,
    create: activeUsersFields,
  });
  seededSlugs.push(activeUsers.slug);

  await prisma.testCase.deleteMany({ where: { problemId: activeUsers.id } });
  await prisma.testCase.createMany({
    data: [
      {
        problemId: activeUsers.id,
        input:
          "CREATE TABLE logins (user_id INT, login_date DATE);\nINSERT INTO logins VALUES (1, '2026-06-20'), (2, '2026-05-01'), (3, '2026-06-25');",
        expectedOutput: "user_id\n1\n3",
        isHidden: false,
        order: 1,
      },
    ],
  });

  // --- 15 additional DSA problems, each with 2 shown + 15 hidden test cases ---

  async function seedDsaProblem<T>(fields: {
    slug: string;
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    tags: string[];
    constraints: string | null;
    signature: FunctionSignature;
    inputs: T[];
    toInput: (t: T) => string;
    toOutput: (t: T) => string;
  }) {
    const problemFields = {
      slug: fields.slug,
      title: fields.title,
      description: fields.description,
      difficulty: fields.difficulty,
      tags: fields.tags,
      type: "DSA" as const,
      constraints: fields.constraints,
      functionSignature: fields.signature as unknown as Prisma.InputJsonValue,
      createdBy: adminId,
    };
    const problem = await prisma.problem.upsert({
      where: { slug: fields.slug },
      update: problemFields,
      create: problemFields,
    });
    await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
    await prisma.testCase.createMany({
      data: buildCases(problem.id, fields.inputs, fields.toInput, fields.toOutput),
    });
    seededSlugs.push(problem.slug);
  }

  // 1. Reverse Integer
  function reverseInteger(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const digits = String(Math.abs(x)).split("").reverse().join("");
    return sign * Number(digits);
  }
  await seedDsaProblem({
    slug: "reverse-integer",
    title: "Reverse Integer",
    description: "Given a 32-bit signed integer `x`, return `x` with its digits reversed, keeping the sign.",
    difficulty: "EASY",
    tags: ["math"],
    constraints: "-2^31 <= x <= 2^31 - 1",
    signature: { functionName: "reverseInteger", params: [{ name: "x", type: "int" }], returnType: "int" },
    inputs: [123, -123, 120, 0, 5, -5, 100, 7, 8000, -8000, 111, -111, 909, 12321, -12321, 100000, -900001],
    toInput: encInt,
    toOutput: (x) => encInt(reverseInteger(x)),
  });

  // 2. Palindrome Number
  function isPalindromeNum(x: number): boolean {
    if (x < 0) return false;
    const s = String(x);
    return s === s.split("").reverse().join("");
  }
  await seedDsaProblem({
    slug: "palindrome-number",
    title: "Palindrome Number",
    description: "Given an integer `x`, return `true` if `x` reads the same forwards and backwards, `false` otherwise.",
    difficulty: "EASY",
    tags: ["math"],
    constraints: "-2^31 <= x <= 2^31 - 1",
    signature: { functionName: "isPalindrome", params: [{ name: "x", type: "int" }], returnType: "boolean" },
    inputs: [121, -121, 10, 0, 1, 12321, 12345, -1, 100, 11, 22, 123321, 909, 5, -55, 1000021, 7],
    toInput: encInt,
    toOutput: (x) => encBool(isPalindromeNum(x)),
  });

  // 3. Valid Parentheses
  function isValidParens(s: string): boolean {
    const stack: string[] = [];
    const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    for (const c of s) {
      if (c === "(" || c === "[" || c === "{") stack.push(c);
      else if (stack.pop() !== pairs[c]) return false;
    }
    return stack.length === 0;
  }
  await seedDsaProblem({
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    description:
      "Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[`, `]`, determine if the input string is valid: every open bracket must be closed by the same type of bracket, in the correct order.",
    difficulty: "EASY",
    tags: ["string", "stack"],
    constraints: "0 <= s.length <= 10^4",
    signature: { functionName: "isValid", params: [{ name: "s", type: "string" }], returnType: "boolean" },
    inputs: [
      "()",
      "()[]{}",
      "(]",
      "([)]",
      "{[]}",
      "",
      "(",
      ")",
      "((()))",
      "(()",
      "()()()",
      "{{[[(())]]}}",
      "([{}])",
      "]",
      "[",
      "(((",
      ")))",
    ],
    toInput: (s) => s,
    toOutput: (s) => encBool(isValidParens(s)),
  });

  // 4. Maximum Subarray
  function maxSubArray(nums: number[]): number {
    let best = nums[0],
      cur = nums[0];
    for (let i = 1; i < nums.length; i++) {
      cur = Math.max(nums[i], cur + nums[i]);
      best = Math.max(best, cur);
    }
    return best;
  }
  await seedDsaProblem({
    slug: "maximum-subarray",
    title: "Maximum Subarray",
    description: "Given an integer array `nums`, find the contiguous subarray with the largest sum and return that sum.",
    difficulty: "MEDIUM",
    tags: ["array", "dynamic-programming"],
    constraints: "1 <= nums.length <= 10^5",
    signature: { functionName: "maxSubArray", params: [{ name: "nums", type: "int[]" }], returnType: "int" },
    inputs: [
      [-2, 1, -3, 4, -1, 2, 1, -5, 4],
      [1],
      [5, 4, -1, 7, 8],
      [-1],
      [-2, -1],
      [0, 0, 0],
      [1, 2, 3, 4, 5],
      [-5, -4, -3, -2, -1],
      [3, -2, 5, -1],
      [2, -1, 2, 3, -9, 4],
      [-8, 3, -1, 4, -2, -6, 10, -2],
      [100],
      [-100],
      [1, -1, 1, -1, 1],
      [4, -1, 2, 1, -5, 4],
      [7, -3, -2, 5, -1, 4, -6, 9, -8],
      [-1, -2, -3, -4],
    ],
    toInput: encIntArray,
    toOutput: (a) => encInt(maxSubArray(a)),
  });

  // 5. Move Zeroes
  function moveZeroes(nums: number[]): number[] {
    const nonZero = nums.filter((n) => n !== 0);
    return nonZero.concat(new Array(nums.length - nonZero.length).fill(0));
  }
  await seedDsaProblem({
    slug: "move-zeroes",
    title: "Move Zeroes",
    description:
      "Given an integer array `nums`, move all `0`s to the end while keeping the relative order of the non-zero elements. Return the resulting array.",
    difficulty: "EASY",
    tags: ["array", "two-pointers"],
    constraints: "1 <= nums.length <= 10^4",
    signature: { functionName: "moveZeroes", params: [{ name: "nums", type: "int[]" }], returnType: "int[]" },
    inputs: [
      [0, 1, 0, 3, 12],
      [0],
      [1],
      [0, 0, 0],
      [1, 2, 3],
      [1, 0, 2, 0, 3],
      [0, 0, 1],
      [1, 0, 0],
      [5, 0, 0, 4, 0, 3],
      [0, 1],
      [1, 0],
      [4, 0, 5, 0, 6, 0, 7],
      [0, 0, 0, 0, 1],
      [2, 1],
      [0, -1, 0, -2],
      [-1, 0, -2, 0, -3],
      [10, 0, 20, 0, 30, 0, 40],
    ],
    toInput: encIntArray,
    toOutput: (a) => encIntArray(moveZeroes(a)),
  });

  // 6. Best Time to Buy and Sell Stock
  function maxProfit(prices: number[]): number {
    let minPrice = prices[0],
      best = 0;
    for (let i = 1; i < prices.length; i++) {
      best = Math.max(best, prices[i] - minPrice);
      minPrice = Math.min(minPrice, prices[i]);
    }
    return best;
  }
  await seedDsaProblem({
    slug: "best-time-to-buy-and-sell-stock",
    title: "Best Time to Buy and Sell Stock",
    description:
      "Given an array `prices` where `prices[i]` is the price of a stock on day `i`, choose a single day to buy and a later day to sell to maximize profit. Return the max profit, or `0` if no profit is possible.",
    difficulty: "EASY",
    tags: ["array", "dynamic-programming"],
    constraints: "1 <= prices.length <= 10^5",
    signature: { functionName: "maxProfit", params: [{ name: "prices", type: "int[]" }], returnType: "int" },
    inputs: [
      [7, 1, 5, 3, 6, 4],
      [7, 6, 4, 3, 1],
      [1, 2],
      [2, 1],
      [3, 3, 3, 3],
      [1],
      [1, 2, 3, 4, 5],
      [5, 4, 3, 2, 1],
      [2, 4, 1, 7],
      [10, 7, 5, 8, 11, 9],
      [1, 4, 2],
      [3, 8, 1, 9],
      [100, 1, 100],
      [1, 1000],
      [1000, 1],
      [6, 1, 3, 2, 4, 7],
      [9, 1, 4, 2, 8, 3, 10],
    ],
    toInput: encIntArray,
    toOutput: (a) => encInt(maxProfit(a)),
  });

  // 7. Contains Duplicate
  function containsDuplicate(nums: number[]): boolean {
    return new Set(nums).size !== nums.length;
  }
  await seedDsaProblem({
    slug: "contains-duplicate",
    title: "Contains Duplicate",
    description: "Given an integer array `nums`, return `true` if any value appears at least twice, `false` if every element is distinct.",
    difficulty: "EASY",
    tags: ["array", "hash-set"],
    constraints: "1 <= nums.length <= 10^5",
    signature: { functionName: "containsDuplicate", params: [{ name: "nums", type: "int[]" }], returnType: "boolean" },
    inputs: [
      [1, 2, 3, 1],
      [1, 2, 3, 4],
      [1, 1, 1, 3, 3, 4, 3, 2, 4, 2],
      [1],
      [1, 2],
      [2, 2],
      [0, 0, 0, 0],
      [-1, -2, -3],
      [-1, -1, 2],
      [5, 4, 3, 2, 1],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 1],
      [100, 200, 300],
      [100, 200, 100],
      [7],
      [7, 7],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 9],
    ],
    toInput: encIntArray,
    toOutput: (a) => encBool(containsDuplicate(a)),
  });

  // 8. Single Number
  function singleNumber(nums: number[]): number {
    return nums.reduce((acc, n) => acc ^ n, 0);
  }
  await seedDsaProblem({
    slug: "single-number",
    title: "Single Number",
    description:
      "Given a non-empty integer array `nums` where every element appears exactly twice except for one, find and return the single element that appears only once.",
    difficulty: "EASY",
    tags: ["array", "bit-manipulation"],
    constraints: "1 <= nums.length <= 3 * 10^4",
    signature: { functionName: "singleNumber", params: [{ name: "nums", type: "int[]" }], returnType: "int" },
    inputs: [
      [2, 2, 1],
      [4, 1, 2, 1, 2],
      [1],
      [0, 1, 0],
      [7, 3, 7],
      [5, 5, 9],
      [-1, -1, -2],
      [10, 20, 10],
      [3, 3, 5, 5, 8],
      [1, 1, 2, 2, 3, 3, 4],
      [9, 9, 10],
      [-5, -5, -6],
      [0, 0, 7],
      [100, 100, 50, 50, 25],
      [6, 10, 6],
      [1, 2, 1, 2, 3],
      [4, 5, 4, 6, 5],
    ],
    toInput: encIntArray,
    toOutput: (a) => encInt(singleNumber(a)),
  });

  // 9. Average of Array
  function average(nums: number[]): number {
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }
  await seedDsaProblem({
    slug: "average-of-array",
    title: "Average of Array",
    description: "Given a non-empty integer array `nums`, return the average of its elements as a floating-point number.",
    difficulty: "EASY",
    tags: ["array", "math"],
    constraints: "1 <= nums.length <= 10^4",
    signature: { functionName: "average", params: [{ name: "nums", type: "int[]" }], returnType: "double" },
    inputs: [
      [1, 2, 3, 4, 5],
      [10, 20, 30],
      [5],
      [-5, 5],
      [0, 0, 0],
      [1, 1, 1, 1],
      [2, 4, 6, 8, 10],
      [-1, -2, -3, -4],
      [100, 200, 300, 400],
      [1, 2],
      [7, 7, 7],
      [3, 6, 9, 12, 15, 18],
      [-10, 10],
      [1, 3, 5, 7, 9],
      [2, 3],
      [50, 60, 70, 80, 90],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    ],
    toInput: encIntArray,
    toOutput: (a) => encDouble(average(a)),
  });

  // 10. Climbing Stairs
  function climbStairs(n: number): number {
    if (n <= 2) return n;
    let a = 1,
      b = 2;
    for (let i = 3; i <= n; i++) {
      const c = a + b;
      a = b;
      b = c;
    }
    return b;
  }
  await seedDsaProblem({
    slug: "climbing-stairs",
    title: "Climbing Stairs",
    description:
      "You're climbing a staircase of `n` steps. Each move you can climb 1 or 2 steps. Return the number of distinct ways to reach the top.",
    difficulty: "EASY",
    tags: ["dynamic-programming", "math"],
    constraints: "1 <= n <= 45",
    signature: { functionName: "climbStairs", params: [{ name: "n", type: "int" }], returnType: "int" },
    inputs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 20],
    toInput: encInt,
    toOutput: (n) => encInt(climbStairs(n)),
  });

  // 11. Longest Common Prefix
  function longestCommonPrefix(strs: string[]): string {
    if (strs.length === 0) return "";
    let prefix = strs[0];
    for (let i = 1; i < strs.length; i++) {
      while (!strs[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (prefix === "") return "";
      }
    }
    return prefix;
  }
  await seedDsaProblem({
    slug: "longest-common-prefix",
    title: "Longest Common Prefix",
    description: "Given an array of strings `strs`, return the longest common prefix shared by all of them, or `\"\"` if none.",
    difficulty: "EASY",
    tags: ["string"],
    constraints: "1 <= strs.length <= 200",
    signature: { functionName: "longestCommonPrefix", params: [{ name: "strs", type: "string[]" }], returnType: "string" },
    inputs: [
      ["flower", "flow", "flight"],
      ["dog", "racecar", "car"],
      ["interspecies", "interstellar", "interstate"],
      ["throne", "throne"],
      ["throne", "dungeon"],
      ["a"],
      ["ab", "a"],
      ["cir", "car"],
      ["prefix", "pre", "precede"],
      ["same", "same", "same"],
      ["", "abc"],
      ["x"],
      ["abcd", "abce", "abcf"],
      ["go", "gopher", "golang"],
      ["test", "testing", "tester"],
      ["single"],
      ["aaa", "aa", "a"],
    ],
    toInput: encStringArray,
    toOutput: (a) => longestCommonPrefix(a),
  });

  // 12. Merge Two Sorted Lists
  function mergeSortedArrays(a: number[], b: number[]): number[] {
    const result: number[] = [];
    let i = 0,
      j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] <= b[j]) result.push(a[i++]);
      else result.push(b[j++]);
    }
    while (i < a.length) result.push(a[i++]);
    while (j < b.length) result.push(b[j++]);
    return result;
  }
  await seedDsaProblem({
    slug: "merge-two-sorted-lists",
    title: "Merge Two Sorted Lists",
    description: "Given two sorted linked lists `list1` and `list2`, merge them into one sorted linked list and return it.",
    difficulty: "EASY",
    tags: ["linked-list"],
    constraints: "0 <= list.length <= 50",
    signature: {
      functionName: "mergeTwoLists",
      params: [
        { name: "list1", type: "ListNode" },
        { name: "list2", type: "ListNode" },
      ],
      returnType: "ListNode",
    },
    inputs: [
      [[1, 2, 4], [1, 3, 4]],
      [[], []],
      [[], [0]],
      [[1, 2, 3], []],
      [[5], [5]],
      [[1, 3, 5, 7], [2, 4, 6, 8]],
      [[-3, -1, 0], [-2, 2, 5]],
      [[1], [2]],
      [[2], [1]],
      [[1, 1, 1], [1, 1]],
      [[0], [0]],
      [[10, 20, 30], [5, 15, 25, 35]],
      [[-5, -4, -3], [-6, -2, -1]],
      [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]],
      [[100], []],
      [[], [100]],
      [[3, 3, 3], [3, 3, 3]],
    ] as [number[], number[]][],
    toInput: ([a, b]) => `${encIntArray(a)}\n${encIntArray(b)}`,
    toOutput: ([a, b]) => encIntArray(mergeSortedArrays(a, b)),
  });

  // 13/14. Binary tree problems share the same 17 trees.
  const treeInputs: string[] = [
    "1 2 3",
    "1 2 3 4 5 6 7",
    "5",
    "1 2 # 3",
    "1 # 2 # 3",
    "",
    "0",
    "-1 -2 -3",
    "1 2 3 # # 4 5",
    "10 5 15 3 7 12 18 1 4 6 8 11 13 16 20",
    "100",
    "2 1",
    "2 # 1",
    "50 30 70 20 40 60 80 10 25 35 45 55 65 75 90",
    "1 2 2 3 3 3 3",
    "9 -3 20 # # 15 7",
    "1",
  ];
  function tokensOf(tree: string): string[] {
    return tree.trim() === "" ? [] : tree.split(" ");
  }

  await seedDsaProblem({
    slug: "binary-tree-inorder-traversal",
    title: "Binary Tree Inorder Traversal",
    description: "Given the `root` of a binary tree, return the values of its nodes using an inorder traversal (left, root, right).",
    difficulty: "EASY",
    tags: ["tree", "binary-tree", "dfs"],
    constraints: "0 <= number of nodes <= 100",
    signature: { functionName: "inorderTraversal", params: [{ name: "root", type: "TreeNode" }], returnType: "int[]" },
    inputs: treeInputs,
    toInput: (t) => t,
    toOutput: (t) => encIntArray(inorder(buildTree(tokensOf(t)))),
  });

  await seedDsaProblem({
    slug: "maximum-depth-of-binary-tree",
    title: "Maximum Depth of Binary Tree",
    description: "Given the `root` of a binary tree, return its maximum depth (the number of nodes along the longest root-to-leaf path).",
    difficulty: "EASY",
    tags: ["tree", "binary-tree", "dfs"],
    constraints: "0 <= number of nodes <= 10^4",
    signature: { functionName: "maxDepth", params: [{ name: "root", type: "TreeNode" }], returnType: "int" },
    inputs: treeInputs,
    toInput: (t) => t,
    toOutput: (t) => encInt(depth(buildTree(tokensOf(t)))),
  });

  // 15. Transpose Matrix
  function transpose(matrix: number[][]): number[][] {
    const rows = matrix.length,
      cols = matrix[0].length;
    const result: number[][] = [];
    for (let c = 0; c < cols; c++) {
      const row: number[] = [];
      for (let r = 0; r < rows; r++) row.push(matrix[r][c]);
      result.push(row);
    }
    return result;
  }
  await seedDsaProblem({
    slug: "transpose-matrix",
    title: "Transpose Matrix",
    description: "Given a 2D integer array `matrix`, return its transpose (rows and columns swapped).",
    difficulty: "MEDIUM",
    tags: ["array", "matrix"],
    constraints: "1 <= rows, cols <= 100",
    signature: { functionName: "transpose", params: [{ name: "matrix", type: "int[][]" }], returnType: "int[][]" },
    inputs: [
      [[1, 2, 3], [4, 5, 6]],
      [[1, 2], [3, 4]],
      [[1]],
      [[1, 2, 3, 4]],
      [[1], [2], [3]],
      [[1, 2], [3, 4], [5, 6]],
      [[0, 0], [0, 0]],
      [[-1, -2], [-3, -4]],
      [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
      [[5, 10], [15, 20], [25, 30]],
      [[1, 2, 3, 4, 5]],
      [[1], [2], [3], [4], [5]],
      [[9, 8, 7], [6, 5, 4]],
      [[100, 200], [300, 400]],
      [[1, 0], [0, 1]],
      [[2, 4, 6], [8, 10, 12]],
      [[-1, 0, 1], [2, -2, 3]],
    ],
    toInput: encIntMatrix,
    toOutput: (m) => encIntMatrix(transpose(m)),
  });

  console.log(`Seeded ${seededSlugs.length} problems:`, seededSlugs.join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
