import { describe, expect, it } from 'vitest';
import { RESERVED_OUTPUT_TOKENS } from '../constants.js';
import { estimateInputTokens, reservedOutputTokens } from './token-estimate.js';

describe('token estimates', () => {
  it('uses the shared approximate formula and output reservation', () => {
    expect(estimateInputTokens(401)).toBe(122);
    expect(reservedOutputTokens(3)).toBe(RESERVED_OUTPUT_TOKENS * 3);
  });
});
