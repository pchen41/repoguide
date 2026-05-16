import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESERVED_OUTPUT_TOKENS, NO_GUIDE_SENTINEL } from '../constants.js';
import { assertLlmConfig } from '../config/env.js';
import { OpenAIGuideProvider } from './openai.js';

function config() {
  return {
    OPENAI_API_KEY: 'test-key',
    REPOGUIDE_MODEL: 'test-model',
    REPOGUIDE_PROVIDER: 'openai',
    REPOGUIDE_MAX_FILE_BYTES: 50000
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('OpenAIGuideProvider', () => {
  it('sends the expected model, prompt, and output token limit', async () => {
    const create = vi.fn().mockResolvedValue({ output_text: '# .\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n' });
    const provider = new OpenAIGuideProvider(config(), { responses: { create } } as never);

    const result = await provider.generateGuide('.', 'prompt text');

    expect(result.type).toBe('guide');
    expect(create).toHaveBeenCalledWith(
      {
        model: 'test-model',
        input: 'prompt text',
        max_output_tokens: RESERVED_OUTPUT_TOKENS
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('parses exact no-guide responses after trimming', async () => {
    const create = vi.fn().mockResolvedValue({ output_text: `\n${NO_GUIDE_SENTINEL}\n` });
    const provider = new OpenAIGuideProvider(config(), { responses: { create } } as never);

    await expect(provider.generateGuide('src', 'prompt')).resolves.toEqual({ type: 'no-guide' });
  });

  it('retries one transient provider error and returns the second result', async () => {
    vi.useFakeTimers();
    const rateLimit = Object.assign(new Error('rate limited'), { status: 429 });
    const create = vi.fn().mockRejectedValueOnce(rateLimit).mockResolvedValueOnce({ output_text: '# src\n' });
    const provider = new OpenAIGuideProvider(config(), { responses: { create } } as never);

    const pending = provider.generateGuide('src', 'prompt');
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toEqual({ type: 'guide', markdown: '# src\n' });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('surfaces non-transient provider errors with folder context', async () => {
    const create = vi.fn().mockRejectedValue(new Error('bad request'));
    const provider = new OpenAIGuideProvider(config(), { responses: { create } } as never);

    await expect(provider.generateGuide('src', 'prompt')).resolves.toEqual({ type: 'error', message: 'src: bad request' });
  });

  it('aborts slow requests and reports the timeout error', async () => {
    vi.useFakeTimers();
    const create = vi.fn((_body, options: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    const provider = new OpenAIGuideProvider(config(), { responses: { create } } as never, 25);

    const pending = provider.generateGuide('src', 'prompt');
    await vi.advanceTimersByTimeAsync(25);

    await expect(pending).resolves.toEqual({ type: 'error', message: 'src: aborted' });
  });
});

describe('LLM config validation', () => {
  it('requires API keys and model names for LLM commands', () => {
    expect(() => assertLlmConfig({ ...config(), OPENAI_API_KEY: undefined })).toThrow(/OPENAI_API_KEY/);
    expect(() => assertLlmConfig({ ...config(), REPOGUIDE_MODEL: undefined })).toThrow(/REPOGUIDE_MODEL/);
    expect(() => assertLlmConfig({ ...config(), REPOGUIDE_PROVIDER: 'other' })).toThrow(/Unsupported/);
  });
});
