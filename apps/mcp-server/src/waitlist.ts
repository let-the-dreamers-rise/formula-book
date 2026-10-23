import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The local demo waitlist: a JSON file in DATA_DIR, emptied by /admin/reset-demo. No payment is set up.
export const WAITLIST_STORE_LABEL = "Local demo store";
const FILE = "waitlist.json";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;

interface Entry {
  readonly email: string;
  readonly at: string;
}

export function readWaitlist(dir: string): readonly Entry[] {
  const path = join(dir, FILE);
  if (!existsSync(path)) return [];
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(parsed) ? (parsed as Entry[]) : [];
}

export function validEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const email = value.trim().toLowerCase();
  return email.length <= MAX_EMAIL && EMAIL.test(email) ? email : undefined;
}

/** Adds the address once; returns the list as stored. */
export function joinWaitlist(dir: string, email: string): readonly Entry[] {
  const current = readWaitlist(dir);
  if (current.some((entry) => entry.email === email)) return current;
  const next = [...current, { email, at: new Date().toISOString() }];
  mkdirSync(dir, { recursive: true });
  const path = join(dir, FILE);
  writeFileSync(`${path}.tmp`, JSON.stringify(next, null, 2));
  renameSync(`${path}.tmp`, path);
  return next;
}
