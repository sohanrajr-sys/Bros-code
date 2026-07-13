import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

/**
 * One-off backfill: points any Problem.createdBy / Submission.userId rows
 * that aren't a real User.id (e.g. the pre-auth "seed-script" literal, or
 * client-supplied test values) at the bootstrapped admin account, so the
 * upcoming FK migration doesn't fail on stale data. Safe to re-run.
 */
async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    throw new Error("No admin user found — run `npm run db:seed` with ADMIN_EMAIL/ADMIN_PASSWORD set first.");
  }

  const validUserIds = (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id);

  const staleProblems = await prisma.problem.updateMany({
    where: { createdBy: { notIn: validUserIds } },
    data: { createdBy: admin.id },
  });
  const staleSubmissions = await prisma.submission.updateMany({
    where: { userId: { notIn: validUserIds } },
    data: { userId: admin.id },
  });

  console.log(`Backfilled ${staleProblems.count} Problem row(s) and ${staleSubmissions.count} Submission row(s) to admin ${admin.email}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
