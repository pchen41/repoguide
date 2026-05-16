# src/llm

## Responsibility

`src/llm` is the provider boundary between RepoGuide’s prompt-generation/orchestration code and external LLM APIs. It defines the small contract the rest of the application depends on (`GuideProvider`) and contains the OpenAI implementation used to turn a folder-specific prompt into one of three outcomes:

- a markdown guide to write,
- an explicit “no guide needed” decision,
- or an error message associated with the folder being processed.

This folder should stay focused on transport/provider concerns: API calls, retries, timeouts, provider-specific response extraction, and mapping responses into `ProviderResult`. Prompt construction, guide validation rules, file traversal, and write orchestration belong outside this folder.

## Important Files

- `src/llm/provider.ts` — Defines the provider abstraction consumed by the rest of the application. Any new LLM backend should implement `GuideProvider.generateGuide(folderPath, prompt)` and return the existing `ProviderResult` union rather than throwing for normal provider failures.
- `src/llm/openai.ts` — OpenAI Responses API implementation. This is where model selection, output token reservation, timeout behavior, transient retry policy, and no-guide response parsing are applied.
- `src/llm/openai.test.ts` — Captures the provider contract: exact `max_output_tokens`, sentinel handling, one retry for transient status codes, timeout aborts, and folder-prefixed error messages. Update these tests when changing provider semantics.

## Child Modules

None.

## Notes

- `generateGuide` is intentionally result-oriented: provider errors are returned as `{ type: 'error', message }` instead of being thrown. Callers can process many folders without a single provider failure aborting the whole run.
- Error messages from `OpenAIGuideProvider` are prefixed with `folderPath`. Preserve this behavior so batch runs can report which folder failed.
- The no-guide decision is recognized via `isNoGuideResponse` from `src/guides/validate.ts`, not by ad hoc string comparison in callers. Keep sentinel parsing centralized there.
- `RESERVED_OUTPUT_TOKENS` from `src/constants.ts` is passed as `max_output_tokens`. Changing this affects all generated guide lengths and should be tested against real provider behavior.
- The OpenAI implementation retries exactly once for transient HTTP-style statuses: `408`, `409`, `425`, `429`, `500`, `502`, `503`, and `504`. Non-transient errors are surfaced immediately.
- Each attempt gets its own `AbortController`; the timeout is cleared in `finally`. If you change retry or timeout logic, make sure abandoned timers/signals cannot leak across attempts.
- `assertLlmConfig` validation lives under `src/config`, but `src/llm/openai.test.ts` verifies the assumptions this provider depends on: OpenAI provider selection, API key presence, and model presence.
- The provider currently uses `response.output_text` from the OpenAI Responses API. If migrating OpenAI SDK APIs or adding streaming, keep the `GuideProvider` contract stable unless the application orchestration is updated at the same time.
