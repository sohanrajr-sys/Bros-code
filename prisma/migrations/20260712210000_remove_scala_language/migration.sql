-- Postgres has no ALTER TYPE ... DROP VALUE, so enum value removal goes
-- through the standard rename-recreate-swap pattern.
BEGIN;

CREATE TYPE "Language_new" AS ENUM ('C', 'CPP', 'JAVA', 'PYTHON', 'GO', 'SQL');

ALTER TABLE "Submission" ALTER COLUMN "language" TYPE "Language_new" USING ("language"::text::"Language_new");

ALTER TYPE "Language" RENAME TO "Language_old";
ALTER TYPE "Language_new" RENAME TO "Language";
DROP TYPE "Language_old";

COMMIT;
