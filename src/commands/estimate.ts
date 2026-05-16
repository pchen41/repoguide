import fs from 'node:fs';
import { loadConfig } from '../config/env.js';
import { RESERVED_OUTPUT_TOKENS } from '../constants.js';
import { absoluteFromRepo, guidePathForFolder } from '../core/paths.js';
import { buildRepoContext, initPlan, repoRelativeFolder, updatePlan } from '../core/plans.js';
import { freshnessForFolder } from '../core/stale.js';
import { estimateInputTokens, reservedOutputTokens } from '../core/token-estimate.js';
import { buildGuidePrompt } from '../guides/prompts.js';
import type { FolderNode } from '../core/tree.js';
import type { CommandResult } from './check.js';

type EstimateKind = 'init' | 'update';

export async function runEstimate(kind: EstimateKind, cwd = process.cwd()): Promise<CommandResult> {
  const { config, repoRoot } = loadConfig(cwd);
  const context = buildRepoContext(repoRoot, cwd);
  const current = repoRelativeFolder(repoRoot, cwd);
  const folders = kind === 'init' ? estimateInitFolders(context) : estimateUpdateFolders(context, current);
  const rows = folders.map((folder) => estimateFolder(context, folder, config.REPOGUIDE_MAX_FILE_BYTES));
  const totalInput = rows.reduce((sum, row) => sum + row.inputTokens, 0);
  rows.sort((a, b) => b.inputTokens - a.inputTokens || a.folder.path.localeCompare(b.folder.path));

  console.log('Estimates are approximate.');
  console.log(`input_tokens=${totalInput}`);
  console.log(`reserved_output_tokens=${reservedOutputTokens(rows.length)}`);
  console.log(`folder_count=${rows.length}`);
  console.log(`reserved_output_tokens_per_folder=${RESERVED_OUTPUT_TOKENS}`);
  console.log('largest_folders:');
  for (const row of rows.slice(0, 5)) console.log(`- ${row.folder.path}: ${row.inputTokens}`);
  return { exitCode: 0 };
}

function estimateInitFolders(context: ReturnType<typeof buildRepoContext>): FolderNode[] {
  return initPlan(context).filter((folder) => !fs.existsSync(absoluteFromRepo(context.repoRoot, guidePathForFolder(folder.path))));
}

function estimateUpdateFolders(context: ReturnType<typeof buildRepoContext>, currentFolder: string): FolderNode[] {
  const plan = updatePlan(context, currentFolder);
  return [...plan.child, ...plan.parent].filter((folder) => {
    const freshness = freshnessForFolder(context.repoRoot, folder, context.sourceFiles);
    return freshness.needsAttention && !freshness.missing;
  });
}

function estimateFolder(context: ReturnType<typeof buildRepoContext>, folder: FolderNode, maxFileBytes: number): { folder: FolderNode; inputTokens: number } {
  const prompt = buildGuidePrompt({
    repoRoot: context.repoRoot,
    folder,
    tree: context.tree,
    gitEntries: context.gitEntryMap,
    maxFileBytes
  });
  return { folder, inputTokens: estimateInputTokens(prompt.characterCount) };
}
