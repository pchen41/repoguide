# src/llm

## How This Fits

`src/llm` is the provider boundary for guide generation. Code outside this folder should talk to the `GuideProvider` interface in `src/llm/provider.ts` rather than directly depending on a vendor SDK.

The current implementation is OpenAI-backed via `OpenAIGuideProvider` in `src/llm/openai.ts`. It accepts a fully composed prompt and returns one normalized `ProviderResult`:

- `{ type: 'guide', markdown }` for committed guide content
- `{ type: 'no-guide' }` when the model returns the exact no-guide sentinel
- `{ type: 'error', message }` for provider failures that should be reported without throwing

This folder does not build prompts, validate guide shape, walk the repo, or decide which folders deserve guides. Those responsibilities live elsewhere. The LLM layer’s job is to send the prompt, enforce provider-level limits/timeouts/retries, and normalize the provider response.

## Provider Contract

`GuideProvider.generateGuide(folderPath, prompt)` must be safe for orchestration code to call without wrapping provider-specific exceptions.

Important invariants:

- Return a `ProviderResult`; do not throw for ordinary provider/API failures.
- Include `folderPath` in error messages so callers can report which guide failed.
- Preserve model output exactly for successful guides. `openai.ts` returns `response.output_text` unchanged unless it is the no-guide sentinel.
- Recognize no-guide responses through `isNoGuideResponse` from `src/guides/validate.ts`, not by duplicating sentinel parsing.
- Use `RESERVED_OUTPUT_TOKENS` from `src/constants.ts` for `max_output_tokens`; do not hard-code an unrelated provider limit here.

## OpenAI Workflow

`OpenAIGuideProvider` uses the OpenAI Responses API:

```ts
client.responses.create(
  {
    model,
    input: prompt,
    max_output_tokens: RESERVED_OUTPUT_TOKENS
  },
  { signal }
)
```

The constructor takes `RepoGuideConfig`, an optional OpenAI-like client, and an optional timeout. The injected client is intentionally typed as `Pick<OpenAI, 'responses'>`, which keeps tests and future adapters lightweight.

Operational behavior:

- Default request timeout is 60 seconds.
- Requests are aborted with `AbortController`.
- One retry is attempted for transient HTTP-style statuses: `408`, `409`, `425`, `429`, `500`, `502`, `503`, `504`.
- Retry delay is currently fixed at 500 ms.
- Non-transient failures and exhausted retries are converted into `{ type: 'error' }`.

If you add another provider, keep these semantics consistent unless the wider orchestration layer is also updated.

## Config Expectations

The provider assumes LLM config has already been validated. `src/llm/openai.test.ts` exercises validation through `assertLlmConfig` from `src/config/env.ts` to ensure LLM commands require:

- `OPENAI_API_KEY`
- `REPOGUIDE_MODEL`
- supported `REPOGUIDE_PROVIDER`

`OpenAIGuideProvider` still defensively falls back to an empty string for `REPOGUIDE_MODEL`, but that should not be treated as a valid runtime path. Fix validation/config flow rather than relying on that fallback.

## Gotchas

- The no-guide response must be exact after trimming. Do not interpret arbitrary prose like “no guide needed” as a sentinel.
- `output_text` may be missing from the OpenAI response; the current behavior treats that as an empty guide, not an error. Change this only with tests and awareness of downstream validation.
- `generateGuide` catches errors and returns error results. Throwing from provider implementations will likely break callers that expect normalized results.
- The retry loop creates a fresh `AbortController` per attempt. Preserve that pattern if changing retry behavior.
- If adding exponential backoff or more retries, update timer-based tests to avoid slow or flaky test runs.

## Testing Notes

`src/llm/openai.test.ts` uses an injected fake OpenAI client rather than mocking the SDK globally. Follow that pattern for provider changes.

Existing coverage verifies:

- request body includes the configured model, prompt, and `RESERVED_OUTPUT_TOKENS`
- an `AbortSignal` is passed to the SDK
- sentinel responses become `{ type: 'no-guide' }`
- one transient error is retried
- non-transient errors include folder context
- slow requests are aborted
- LLM config validation rejects missing/unsupported settings

When changing timeout or retry behavior, use fake timers (`vi.useFakeTimers()`) and advance timers explicitly so tests remain deterministic.
