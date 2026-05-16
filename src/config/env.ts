import fs from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { RepoGuideError } from '../core/errors.js';
import { findRepoRoot } from '../core/git.js';
import { envSchema, type RepoGuideConfig } from './schema.js';

const RELEVANT_ENV = ['OPENAI_API_KEY', 'REPOGUIDE_PROVIDER', 'REPOGUIDE_MODEL', 'REPOGUIDE_MAX_FILE_BYTES'] as const;

function redact(message: string): string {
  let redacted = message;
  const value = process.env.OPENAI_API_KEY;
  if (value && value.length >= 8) redacted = redacted.split(value).join('[redacted]');
  return redacted;
}

export function loadConfig(cwd: string): { config: RepoGuideConfig; repoRoot: string } {
  const repoRoot = findRepoRoot(cwd);
  const envPath = path.join(repoRoot, '.env');
  const snapshot = new Map<string, string | undefined>();
  for (const key of RELEVANT_ENV) snapshot.set(key, process.env[key]);

  try {
    if (fs.existsSync(envPath)) loadEnvFile(envPath);
  } catch (error) {
    restoreShellEnv(snapshot, true);
    const detail = error instanceof Error ? error.message : String(error);
    throw new RepoGuideError(`Failed to load repo .env: ${redact(detail)}`);
  }

  restoreShellEnv(snapshot, false);

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new RepoGuideError(`Invalid repoguide environment: ${redact(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))}`);
  }

  return { config: parsed.data, repoRoot };
}

function restoreShellEnv(snapshot: Map<string, string | undefined>, deleteMissing: boolean): void {
  for (const [key, value] of snapshot) {
    if (value === undefined) {
      if (deleteMissing) delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

export function assertLlmConfig(config: RepoGuideConfig): void {
  if (config.REPOGUIDE_PROVIDER !== 'openai') {
    throw new RepoGuideError(`Unsupported REPOGUIDE_PROVIDER "${config.REPOGUIDE_PROVIDER}". v1 supports "openai".`);
  }
  if (!config.OPENAI_API_KEY) throw new RepoGuideError('OPENAI_API_KEY is required for guide generation.');
  if (!config.REPOGUIDE_MODEL) throw new RepoGuideError('REPOGUIDE_MODEL is required for guide generation.');
}
