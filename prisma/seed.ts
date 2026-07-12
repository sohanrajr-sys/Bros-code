import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import type { Prisma } from "../src/generated/prisma/client";
import type { FunctionSignature } from "../src/lib/functionSignature";

async function main() {
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
    createdBy: "seed-script",
  };

  const twoSum = await prisma.problem.upsert({
    where: { slug: "two-sum" },
    update: twoSumFields,
    create: twoSumFields,
  });

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
    createdBy: "seed-script",
  };

  const activeUsers = await prisma.problem.upsert({
    where: { slug: "active-users-last-30-days" },
    update: activeUsersFields,
    create: activeUsersFields,
  });

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

  console.log("Seeded problems:", twoSum.slug, activeUsers.slug);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
