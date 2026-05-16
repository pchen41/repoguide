import { describe, expect, it } from 'vitest';
import { NO_GUIDE_SENTINEL } from '../constants.js';
import { isNoGuideResponse, validateGuideMarkdown } from './validate.js';

describe('guide validation', () => {
  it('detects only exact no-guide responses after trimming', () => {
    expect(isNoGuideResponse(`\n${NO_GUIDE_SENTINEL}\n`)).toBe(true);
    expect(isNoGuideResponse(`${NO_GUIDE_SENTINEL}\nextra`)).toBe(false);
  });

  it('accepts free-form guide markdown and rejects wrong or empty structure', () => {
    const valid = '# src\n\n## How This Fits\n\nThis folder coordinates useful work.\n';
    const legacyTemplate = '# src\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n';
    expect(validateGuideMarkdown('src', valid)).toEqual({ ok: true });
    expect(validateGuideMarkdown('src', legacyTemplate)).toEqual({ ok: true });
    expect(validateGuideMarkdown('.', valid).ok).toBe(false);
    expect(validateGuideMarkdown('src', '# src\n\nBody without a section.\n').ok).toBe(false);
    expect(validateGuideMarkdown('src', '# src\n\n').ok).toBe(false);
  });
});
