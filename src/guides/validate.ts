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
  for (const heading of ['## Responsibility', '## Important Files', '## Child Modules', '## Notes']) {
    if (!lines.includes(heading)) return { ok: false, error: `Guide is missing required section "${heading}".` };
  }
  return { ok: true };
}
