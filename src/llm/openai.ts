import OpenAI from 'openai';
import { RESERVED_OUTPUT_TOKENS } from '../constants.js';
import { isNoGuideResponse } from '../guides/validate.js';
import type { RepoGuideConfig } from '../config/schema.js';
import type { GuideProvider, ProviderResult } from './provider.js';

const TRANSIENT_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(error: unknown): boolean {
  const status = error && typeof error === 'object' && 'status' in error ? Number((error as { status?: unknown }).status) : undefined;
  return status !== undefined && TRANSIENT_STATUS.has(status);
}

export class OpenAIGuideProvider implements GuideProvider {
  private readonly client: Pick<OpenAI, 'responses'>;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: RepoGuideConfig, client = new OpenAI({ apiKey: config.OPENAI_API_KEY }), timeoutMs = 60000) {
    this.client = client;
    this.model = config.REPOGUIDE_MODEL ?? '';
    this.timeoutMs = timeoutMs;
  }

  async generateGuide(folderPath: string, prompt: string): Promise<ProviderResult> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.client.responses.create(
          {
            model: this.model,
            input: prompt,
            max_output_tokens: RESERVED_OUTPUT_TOKENS
          },
          { signal: controller.signal }
        );
        const text = response.output_text ?? '';
        if (isNoGuideResponse(text)) return { type: 'no-guide' };
        return { type: 'guide', markdown: text };
      } catch (error) {
        if (attempt === 0 && isTransient(error)) {
          await sleep(500);
          continue;
        }
        const message = error instanceof Error ? error.message : String(error);
        return { type: 'error', message: `${folderPath}: ${message}` };
      } finally {
        clearTimeout(timeout);
      }
    }
    return { type: 'error', message: `${folderPath}: provider retry failed` };
  }
}
