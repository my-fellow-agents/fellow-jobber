import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ZodType } from "zod";
import {
  bulletBankSchema,
  resumeProfileSchema,
  type BulletBank,
  type ResumeProfile,
} from "./schema.js";

async function loadValidatedJson<T>(
  relativePath: string,
  schema: ZodType<T>,
): Promise<T> {
  const absolutePath = resolve(process.cwd(), relativePath);
  const source = await readFile(absolutePath, "utf8");
  const parsed: unknown = JSON.parse(source.replace(/^\uFEFF/, ""));
  const result = schema.safeParse(parsed);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "$"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid ${relativePath}:\n${details}`);
  }

  return result.data;
}

export function loadBulletBank(
  relativePath = "data/bullet-bank.json",
): Promise<BulletBank> {
  return loadValidatedJson(relativePath, bulletBankSchema);
}

export function loadResumeProfile(
  relativePath = "data/resume-profile.json",
): Promise<ResumeProfile> {
  return loadValidatedJson(relativePath, resumeProfileSchema);
}
