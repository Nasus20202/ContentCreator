import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { REPO_ROOT } from './paths';

export class PipelineError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

export function readJson<S extends z.ZodType>(file: string, schema: S): z.infer<S> {
  if (!fs.existsSync(file)) throw new PipelineError(`Missing file: ${path.relative(REPO_ROOT, file)}`);
  const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new PipelineError(`Invalid ${path.relative(REPO_ROOT, file)}:\n${issues}`);
  }
  return parsed.data;
}

export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function appendJsonl(file: string, entry: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(entry) + '\n');
}

export function readJsonl<S extends z.ZodType>(file: string, schema: S): z.infer<S>[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => schema.parse(JSON.parse(l)));
}

/** Stable hash of JSON-serialisable data (key order normalised). */
export function hashData(data: unknown): string {
  return createHash('sha256').update(stableStringify(data)).digest('hex').slice(0, 16);
}

export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${stableStringify(x)}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

export function sha256File(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function gitSha(): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

export const nowIso = (): string => new Date().toISOString();
