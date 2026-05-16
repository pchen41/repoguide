import fs from 'node:fs';
import { TextDecoder } from 'node:util';
import { GUIDE_FILENAME, NO_GUIDE_SENTINEL, PROMPT_BUDGET_CHARS } from '../constants.js';
import type { GitEntry } from '../core/git.js';
import { absoluteFromRepo, guidePathForFolder } from '../core/paths.js';
import type { FolderNode, FolderTree } from '../core/tree.js';

export interface PromptBuildOptions {
  repoRoot: string;
  folder: FolderNode;
  tree: FolderTree;
  gitEntries: Map<string, GitEntry>;
  maxFileBytes: number;
  promptBudgetChars?: number;
}

export interface PromptBuildResult {
  prompt: string;
  characterCount: number;
  skippedNotes: string[];
  truncatedNotes: string[];
}

function readUtf8(buffer: Buffer): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return undefined;
  }
}

function appendWithBudget(parts: string[], value: string, budget: number, notes: string[], label: string): void {
  const used = parts.join('').length;
  const remaining = budget - used;
  if (remaining <= 0) {
    notes.push(`${label} omitted because the prompt budget was exhausted.`);
    return;
  }
  if (value.length <= remaining) {
    parts.push(value);
    return;
  }
  const marker = `\n[truncated: ${label}]\n`;
  const contentBudget = remaining - marker.length;
  if (contentBudget <= 0) {
    notes.push(`${label} omitted because the prompt budget was exhausted.`);
    return;
  }
  let slice = value.slice(0, contentBudget);
  const lastNewline = slice.lastIndexOf('\n');
  if (lastNewline > 80) slice = slice.slice(0, lastNewline + 1);
  parts.push(`${slice}${marker}`);
  notes.push(`${label} truncated to fit the aggregate prompt budget.`);
}

export function buildGuidePrompt(options: PromptBuildOptions): PromptBuildResult {
  const budget = options.promptBudgetChars ?? PROMPT_BUDGET_CHARS;
  const folderPath = options.folder.path;
  const skippedNotes: string[] = [];
  const truncatedNotes: string[] = [];
  const parts: string[] = [];

  parts.push(`You are writing a committed guide.md file for a Git repository folder.\n`);
  parts.push(`Folder: ${folderPath}\n\n`);
  parts.push(`Return exactly ${NO_GUIDE_SENTINEL} as plain text only if this folder does not deserve a guide. Do not wrap the sentinel in markdown fences, backticks, explanations, or extra text.\n`);
  parts.push(`If you write a guide, use this exact structure and mention only real repo-relative paths:\n\n`);
  parts.push(`${folderPath === '.' ? '# .' : `# ${folderPath}`}\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n\n`);

  parts.push(`Direct files:\n${options.folder.directFiles.length ? options.folder.directFiles.map((file) => `- ${file}`).join('\n') : '- none'}\n\n`);

  for (const filePath of options.folder.directFiles) {
    const entry = options.gitEntries.get(filePath);
    const absolutePath = absoluteFromRepo(options.repoRoot, filePath);
    if (entry?.mode === '160000') {
      skippedNotes.push(`${filePath} skipped: submodule gitlink.`);
      continue;
    }
    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      skippedNotes.push(`${filePath} skipped: symlink -> ${fs.readlinkSync(absolutePath)}.`);
      continue;
    }
    if (stat.size > options.maxFileBytes) {
      skippedNotes.push(`${filePath} skipped: ${stat.size} bytes exceeds REPOGUIDE_MAX_FILE_BYTES=${options.maxFileBytes}.`);
      continue;
    }
    const buffer = fs.readFileSync(absolutePath);
    if (buffer.includes(0)) {
      skippedNotes.push(`${filePath} skipped: binary file.`);
      continue;
    }
    const text = readUtf8(buffer);
    if (text === undefined) {
      skippedNotes.push(`${filePath} skipped: invalid UTF-8.`);
      continue;
    }
    appendWithBudget(parts, `File ${filePath}:\n\`\`\`\n${text}\n\`\`\`\n\n`, budget, truncatedNotes, `file ${filePath}`);
  }

  if (skippedNotes.length) {
    appendWithBudget(parts, `Skipped source notes:\n${skippedNotes.map((note) => `- ${note}`).join('\n')}\n\n`, budget, truncatedNotes, 'skipped source notes');
  }

  for (const childPath of options.folder.children) {
    const childGuide = guidePathForFolder(childPath);
    const absoluteGuide = absoluteFromRepo(options.repoRoot, childGuide);
    if (!fs.existsSync(absoluteGuide)) continue;
    const text = fs.readFileSync(absoluteGuide, 'utf8');
    appendWithBudget(parts, `Child guide ${childGuide}:\n${text}\n\n`, budget, truncatedNotes, `child guide ${childGuide}`);
  }

  const notesToReport = [...truncatedNotes];
  if (notesToReport.length) {
    appendWithBudget(parts, `Truncation notes:\n${notesToReport.map((note) => `- ${note}`).join('\n')}\n\n`, budget, truncatedNotes, 'truncation notes');
  }

  let prompt = parts.join('');
  if (prompt.length > budget) {
    prompt = prompt.slice(0, budget);
    truncatedNotes.push('Prompt hard-truncated to the aggregate prompt budget.');
  }

  return { prompt, characterCount: prompt.length, skippedNotes, truncatedNotes };
}

export function outputGuidePath(folder: FolderNode): string {
  return folder.path === '.' ? GUIDE_FILENAME : `${folder.path}/${GUIDE_FILENAME}`;
}
