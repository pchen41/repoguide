import { assertLlmConfig, loadConfig } from '../config/env.js';
import { guidePathForFolder } from '../core/paths.js';
import { buildRepoContext, repoRelativeFolder, updatePlan } from '../core/plans.js';
import { freshnessForFolder, guideHasUncommittedChanges } from '../core/stale.js';
import { generateForFolder } from '../guides/generate.js';
import { OpenAIGuideProvider } from '../llm/openai.js';
import type { GuideProvider } from '../llm/provider.js';
import type { FolderNode } from '../core/tree.js';
import type { CommandResult } from './check.js';

export interface UpdateOptions {
  dryRun?: boolean;
  provider?: GuideProvider;
}

export async function runUpdate(cwd = process.cwd(), options: UpdateOptions = {}): Promise<CommandResult> {
  const { config, repoRoot } = loadConfig(cwd);
  assertLlmConfig(config);
  const context = buildRepoContext(repoRoot, cwd);
  const current = repoRelativeFolder(repoRoot, cwd);
  const provider = options.provider ?? new OpenAIGuideProvider(config);
  const plan = updatePlan(context, current);
  const changedGuides = new Set<string>();
  const counts = { updated: 0, skipped: 0, noGuide: 0, failed: 0, dryRun: 0 };
  let updateIndex = 0;

  async function maybeUpdate(folder: FolderNode): Promise<void> {
    const freshness = freshnessForFolder(repoRoot, folder, context.sourceFiles, changedGuides);
    if (!freshness.needsAttention || freshness.missing) return;
    if (guideHasUncommittedChanges(repoRoot, folder.path)) {
      counts.skipped += 1;
      console.log(`${folder.path}: skipped guide with uncommitted changes`);
      return;
    }
    updateIndex += 1;
    console.log(`update [${updateIndex}] regenerating ${folder.path}`);
    const result = await generateForFolder(context, folder, provider, config.REPOGUIDE_MAX_FILE_BYTES, { dryRun: options.dryRun, updateExisting: true });
    if (result.status === 'updated') {
      counts.updated += 1;
      changedGuides.add(guidePathForFolder(folder.path));
    }
    if (result.status === 'dry-run') counts.dryRun += 1;
    if (result.status === 'no-guide') {
      counts.noGuide += 1;
      console.log(`${folder.path}: provider returned no-guide; existing guide left unchanged`);
    }
    if (result.status === 'failed') {
      counts.failed += 1;
      console.error(`${result.folderPath}: ${result.message ?? 'generation failed'}`);
    }
  }

  for (const folder of plan.child) await maybeUpdate(folder);
  for (const folder of plan.parent) await maybeUpdate(folder);

  console.log(`updated=${counts.updated} skipped=${counts.skipped} no-guide=${counts.noGuide} dry-run=${counts.dryRun} failed=${counts.failed}`);
  return { exitCode: counts.failed > 0 ? 1 : 0 };
}
