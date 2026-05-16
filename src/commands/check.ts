import { loadConfig } from '../config/env.js';
import { buildRepoContext, checkPlan, repoRelativeFolder } from '../core/plans.js';
import { freshnessForFolder } from '../core/stale.js';

export interface CommandResult {
  exitCode: number;
}

export async function runCheck(cwd = process.cwd()): Promise<CommandResult> {
  const { repoRoot } = loadConfig(cwd);
  const context = buildRepoContext(repoRoot, cwd);
  const current = repoRelativeFolder(repoRoot, cwd);
  const attention = checkPlan(context, current)
    .map((folder) => ({ folder, freshness: freshnessForFolder(repoRoot, folder, context.sourceFiles) }))
    .filter((item) => item.freshness.needsAttention);

  if (attention.length === 0) {
    console.log('All guides are fresh.');
    return { exitCode: 0 };
  }
  for (const item of attention) {
    console.log(`${item.folder.path}: ${item.freshness.reasons.join(', ')}`);
  }
  return { exitCode: 1 };
}
