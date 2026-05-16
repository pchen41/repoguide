import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './env.js';
import { createFixtureRepo, type FixtureRepo } from '../test-utils/fixture-repo.js';

let repo: FixtureRepo | undefined;
const savedEnv = new Map<string, string | undefined>();
const keys = ['OPENAI_API_KEY', 'REPOGUIDE_PROVIDER', 'REPOGUIDE_MODEL', 'REPOGUIDE_MAX_FILE_BYTES'];

function snapshotEnv(): void {
  for (const key of keys) savedEnv.set(key, process.env[key]);
}

function restoreEnv(): void {
  for (const key of keys) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
}

afterEach(() => {
  repo?.cleanup();
  repo = undefined;
  restoreEnv();
});

describe('environment config', () => {
  it('loads defaults without LLM secrets', () => {
    snapshotEnv();
    for (const key of keys) delete process.env[key];
    repo = createFixtureRepo();
    const loaded = loadConfig(repo.root);
    expect(loaded.config.REPOGUIDE_PROVIDER).toBe('openai');
    expect(loaded.config.REPOGUIDE_MAX_FILE_BYTES).toBe(50000);
  });

  it('loads .env values while preserving shell precedence', () => {
    snapshotEnv();
    for (const key of keys) delete process.env[key];
    process.env.REPOGUIDE_MODEL = 'from-shell';
    repo = createFixtureRepo();
    fs.writeFileSync(`${repo.root}/.env`, 'REPOGUIDE_MODEL=from-file\nREPOGUIDE_MAX_FILE_BYTES=12\n');
    const loaded = loadConfig(repo.root);
    expect(loaded.config.REPOGUIDE_MODEL).toBe('from-shell');
    expect(loaded.config.REPOGUIDE_MAX_FILE_BYTES).toBe(12);
  });

  it('reports invalid values without printing secrets', () => {
    snapshotEnv();
    for (const key of keys) delete process.env[key];
    process.env.OPENAI_API_KEY = 'secret-value';
    process.env.REPOGUIDE_MAX_FILE_BYTES = '0';
    repo = createFixtureRepo();
    expect(() => loadConfig(repo.root)).toThrow(/Invalid repoguide environment/);
    expect(() => loadConfig(repo.root)).not.toThrow(/secret-value/);
  });
});
