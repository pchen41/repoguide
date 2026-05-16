import fs from 'node:fs';
import { assertLlmConfig, loadConfig } from '../config/env.js';
import { freshnessForFolder } from '../core/stale.js';
import { absoluteFromRepo, guidePathForFolder } from '../core/paths.js';
import { buildRepoContext, initPlan } from '../core/plans.js';
import { generateForFolder } from '../guides/generate.js';
import { OpenAIGuideProvider } from '../llm/openai.js';
import type { GuideProvider } from '../llm/provider.js';
import type { CommandResult } from './check.js';

export interface InitOptions {
  dryRun?: boolean;
  provider?: GuideProvider;
}

export async function runInit(cwd = process.cwd(), options: InitOptions = {}): Promise<CommandResult> {
  const { config, repoRoot } = loadConfig(cwd);
  assertLlmConfig(config);
  const context = buildRepoContext(repoRoot, cwd);
  const provider = options.provider ?? new OpenAIGuideProvider(config);
  const counts = { created: 0, skipped: 0, stale: 0, noGuide: 0, failed: 0, dryRun: 0 };

  for (const folder of initPlan(context)) {
    const guidePath = guidePathForFolder(folder.path);
    if (fs.existsSync(absoluteFromRepo(repoRoot, guidePath))) {
      counts.skipped += 1;
      const freshness = freshnessForFolder(repoRoot, folder, context.sourceFiles);
      if (freshness.stale) {
        counts.stale += 1;
        console.log(`${folder.path}: existing guide appears stale; run repoguide update to refresh it`);
      }
      continue;
    }
    const result = await generateForFolder(context, folder, provider, config.REPOGUIDE_MAX_FILE_BYTES, { dryRun: options.dryRun });
    if (result.status === 'created') counts.created += 1;
    if (result.status === 'dry-run') counts.dryRun += 1;
    if (result.status === 'no-guide') counts.noGuide += 1;
    if (result.status === 'failed') {
      counts.failed += 1;
      console.error(`${result.folderPath}: ${result.message ?? 'generation failed'}`);
    }
  }

  console.log(`created=${counts.created} skipped=${counts.skipped} stale=${counts.stale} no-guide=${counts.noGuide} dry-run=${counts.dryRun} failed=${counts.failed}`);
  return { exitCode: counts.failed > 0 ? 1 : 0 };
}
