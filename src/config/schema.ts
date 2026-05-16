import { z } from 'zod';
import { DEFAULT_MAX_FILE_BYTES } from '../constants.js';

export const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  REPOGUIDE_PROVIDER: z.string().min(1).default('openai'),
  REPOGUIDE_MODEL: z.string().min(1).optional(),
  REPOGUIDE_MAX_FILE_BYTES: z.coerce.number().int().positive().default(DEFAULT_MAX_FILE_BYTES)
});

export type RepoGuideConfig = z.infer<typeof envSchema>;
