import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const twoSum = await prisma.problem.upsert({
    where: { slug: "two-sum" },
    update: {},
    create: {
      slug: "two-sum",
      title: "Two Sum",
      description:
        "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.\n\nEach input has exactly one solution, and you may not use the same element twice.",
      difficulty: "EASY",
      tags: ["array", "hash-map"],
      type: "DSA",
      constraints: "2 <= nums.length <= 10^4",
      createdBy: "seed-script",
      testCases: {
        create: [
          { input: "4\n2 7 11 15\n9", expectedOutput: "0 1", isHidden: false, order: 1 },
          { input: "3\n3 2 4\n6", expectedOutput: "1 2", isHidden: false, order: 2 },
          { input: "2\n3 3\n6", expectedOutput: "0 1", isHidden: true, order: 3 },
        ],
      },
    },
  });

  const activeUsers = await prisma.problem.upsert({
    where: { slug: "active-users-last-30-days" },
    update: {},
    create: {
      slug: "active-users-last-30-days",
      title: "Active Users in the Last 30 Days",
      description:
        "Given a `logins` table with columns `user_id` and `login_date`, write a query that returns the distinct `user_id`s who logged in within the last 30 days of the most recent login date in the table, ordered by `user_id` ascending.",
      difficulty: "MEDIUM",
      tags: ["sql", "dates", "group-by"],
      type: "SQL",
      constraints: null,
      createdBy: "seed-script",
      testCases: {
        create: [
          {
            input:
              "CREATE TABLE logins (user_id INT, login_date DATE);\nINSERT INTO logins VALUES (1, '2026-06-20'), (2, '2026-05-01'), (3, '2026-06-25');",
            expectedOutput: "user_id\n1\n3",
            isHidden: false,
            order: 1,
          },
        ],
      },
    },
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
