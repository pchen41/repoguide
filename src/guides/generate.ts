import fs from 'node:fs';
import path from 'node:path';
import { RepoGuideError } from '../core/errors.js';
import { absoluteFromRepo, guidePathForFolder } from '../core/paths.js';
import type { RepoContext } from '../core/plans.js';
import type { FolderNode } from '../core/tree.js';
import type { GuideProvider } from '../llm/provider.js';
import { buildGuidePrompt } from './prompts.js';
import { validateGuideMarkdown } from './validate.js';

export type GenerateStatus = 'created' | 'updated' | 'no-guide' | 'failed' | 'dry-run';

export interface GenerateResult {
  status: GenerateStatus;
  folderPath: string;
  guidePath: string;
  message?: string;
}

export async function generateForFolder(
  context: RepoContext,
  folder: FolderNode,
  provider: GuideProvider,
  maxFileBytes: number,
  options: { dryRun?: boolean; updateExisting?: boolean } = {}
): Promise<GenerateResult> {
  const guidePath = guidePathForFolder(folder.path);
  const prompt = buildGuidePrompt({
    repoRoot: context.repoRoot,
    folder,
    tree: context.tree,
    gitEntries: context.gitEntryMap,
    maxFileBytes
  }).prompt;
  const result = await provider.generateGuide(folder.path, prompt);
  if (result.type === 'error') return { status: 'failed', folderPath: folder.path, guidePath, message: result.message };
  if (result.type === 'no-guide') return { status: 'no-guide', folderPath: folder.path, guidePath };

  const validation = validateGuideMarkdown(folder.path, result.markdown);
  if (!validation.ok) return { status: 'failed', folderPath: folder.path, guidePath, message: validation.error };
  if (options.dryRun) return { status: 'dry-run', folderPath: folder.path, guidePath };

  const absoluteGuide = absoluteFromRepo(context.repoRoot, guidePath);
  try {
    assertCanWriteGuide(context.repoRoot, folder);
    fs.mkdirSync(path.dirname(absoluteGuide), { recursive: true });
    fs.writeFileSync(absoluteGuide, `${result.markdown.trimEnd()}\n`, { encoding: 'utf8', flag: 'w' });
    return { status: options.updateExisting ? 'updated' : 'created', folderPath: folder.path, guidePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'failed', folderPath: folder.path, guidePath, message };
  }
}

export function assertCanWriteGuide(repoRoot: string, folder: FolderNode): void {
  const absoluteGuide = absoluteFromRepo(repoRoot, guidePathForFolder(folder.path));
  if (!fs.existsSync(absoluteGuide)) return;
  const stat = fs.lstatSync(absoluteGuide);
  if (stat.isSymbolicLink()) throw new RepoGuideError(`${guidePathForFolder(folder.path)} is a symlink; refusing to write it.`);
  if (!stat.isFile()) throw new RepoGuideError(`${guidePathForFolder(folder.path)} exists but is not a regular file.`);
}
