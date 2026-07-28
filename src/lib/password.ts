import bcrypt from "bcrypt";
import { randomInt } from "crypto";

const SALT_ROUNDS = 12;

// Excludes visually ambiguous characters (0/O, 1/l/I) since these are
// hand-transcribed by an admin to a student, not copy-pasted electronically.
const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Lazily-computed, memoized bcrypt hash of an arbitrary value nobody can log
// in with. Callers compare against this when no user was found, so a lookup
// miss burns the same bcrypt time as a real verifyPassword() call — otherwise
// login response time leaks whether a studentId/email is registered.
let dummyHashPromise: Promise<string> | null = null;
export function getDummyPasswordHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(randomInt(2 ** 31).toString());
  }
  return dummyHashPromise;
}

export function generateRandomPassword(length = 12): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}
