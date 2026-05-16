import { NO_GUIDE_SENTINEL } from '../constants.js';

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function isNoGuideResponse(text: string): boolean {
  return text.trim() === NO_GUIDE_SENTINEL;
}

export function validateGuideMarkdown(folderPath: string, markdown: string): ValidationResult {
  if (markdown.trim().length === 0) return { ok: false, error: 'Guide output is empty.' };
  const requiredTitle = folderPath === '.' ? '# .' : `# ${folderPath}`;
  const lines = markdown.trimStart().split(/\r?\n/);
  if (lines[0] !== requiredTitle) return { ok: false, error: `Guide must start with exact heading "${requiredTitle}".` };
  const body = lines.slice(1).join('\n').trim();
  if (body.length === 0) return { ok: false, error: 'Guide must include body content after the top heading.' };
  if (!lines.some((line) => /^##\s+\S/.test(line))) return { ok: false, error: 'Guide must include at least one second-level section heading.' };
  return { ok: true };
}
