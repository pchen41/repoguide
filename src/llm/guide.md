# src/llm

## Responsibility

Provides the LLM provider abstraction and the OpenAI-backed implementation used to generate repository guide content. This module turns prompts into `ProviderResult` values, handles OpenAI Responses API calls, recognizes the no-guide sentinel response, retries one transient provider failure, applies request timeouts, and reports errors with folder context.

## Important Files

- `src/llm/provider.ts`: Defines the shared `GuideProvider` interface and `ProviderResult` union returned by LLM integrations.
- `src/llm/openai.ts`: Implements `OpenAIGuideProvider` using the OpenAI Responses API. It sends the configured model and prompt, caps output tokens with `RESERVED_OUTPUT_TOKENS`, detects no-guide responses via `isNoGuideResponse`, retries transient HTTP statuses once, and aborts slow requests.
- `src/llm/openai.test.ts`: Covers OpenAI request shape, no-guide parsing, retry behavior, error formatting, timeout handling, and LLM config validation.

## Child Modules

None.

## Notes

- `OpenAIGuideProvider.generateGuide()` returns structured results instead of throwing for provider failures.
- Transient retry is limited to one retry for statuses `408`, `409`, `425`, `429`, `500`, `502`, `503`, and `504`.
- The OpenAI client is injectable in `src/llm/openai.ts`, which keeps tests deterministic and avoids real network calls.
- Config validation for required OpenAI settings is tested from `src/llm/openai.test.ts` through `assertLlmConfig`.
