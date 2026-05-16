import { RESERVED_OUTPUT_TOKENS } from '../constants.js';

export function estimateInputTokens(characterCount: number): number {
  return Math.ceil(Math.ceil(characterCount / 4) * 1.2);
}

export function reservedOutputTokens(folderCount: number): number {
  return folderCount * RESERVED_OUTPUT_TOKENS;
}
