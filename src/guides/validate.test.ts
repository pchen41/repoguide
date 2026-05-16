import { describe, expect, it } from 'vitest';
import { NO_GUIDE_SENTINEL } from '../constants.js';
import { isNoGuideResponse, validateGuideMarkdown } from './validate.js';

describe('guide validation', () => {
  it('detects only exact no-guide responses after trimming', () => {
    expect(isNoGuideResponse(`\n${NO_GUIDE_SENTINEL}\n`)).toBe(true);
    expect(isNoGuideResponse(`${NO_GUIDE_SENTINEL}\nextra`)).toBe(false);
  });

  it('accepts valid guide markdown and rejects wrong headings', () => {
    const valid = '# src\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n';
    expect(validateGuideMarkdown('src', valid)).toEqual({ ok: true });
    expect(validateGuideMarkdown('.', valid).ok).toBe(false);
    expect(validateGuideMarkdown('src', '# src\n\n## responsibility\n').ok).toBe(false);
  });
});
