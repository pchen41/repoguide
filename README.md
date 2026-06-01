# repoguide

Generate `guide.md` wiki pages for Git repositories to provide context to humans and AI.

`repoguide` reads the tracked files in your repo, asks an LLM to explain the folders that matter, and writes the results back into the tree as normal Markdown. Leaves useful local context including what a folder owns, how it fits with nearby modules and what is easy to misuse.

It can also turn those guides into a ready-to-view static HTML wiki for browsing, sharing, or publishing.

## Why

For large codebases, the shape of the system often lives in people's heads. LLM agents can read through code, but often gets stuck in the weeds instead of seeing the bigger picture. Having summaries of each folder help people figure out where to look and point out non-obvious behavior that would otherwise lead to bugs or non-optimal implementation.

## Status

This is an early TypeScript CLI. It currently supports OpenAI-compatible generation through the official OpenAI SDK, requires Node.js 26.x, and is designed to be run inside Git repositories.

## Install

From a local checkout:

```sh
npm install
npm run build
npm link
```

After linking, run `repoguide --help` from any Git repository.

## Configuration

Generation commands require an OpenAI API key and an explicit model. You can set them in your shell or in a repo-root `.env` file:

```env
OPENAI_API_KEY=sk-...
REPOGUIDE_MODEL=gpt-5.1
REPOGUIDE_PROVIDER=openai
REPOGUIDE_MAX_FILE_BYTES=50000
```

Shell environment variables take precedence over `.env`. `REPOGUIDE_PROVIDER` defaults to `openai`, and `REPOGUIDE_MAX_FILE_BYTES` defaults to `50000`.

`check`, `site`, and `estimate` do not call an LLM and do not require an API key.

## Quick Start

Run this from the repository you want to document:

```sh
repoguide estimate init
repoguide init
git diff
```

Review the generated `guide.md` files like any other code change. Edit them if needed, then commit them with the codebase.

When code changes later:

```sh
repoguide check
repoguide update
repoguide site
git diff
```

## Commands

```sh
repoguide init
repoguide init --force
repoguide check
repoguide update
repoguide site
repoguide estimate init
repoguide estimate update
```

### `init`

Creates missing guides bottom-up for the current folder and its descendants. Existing guides are skipped by default. Use `--force` to regenerate existing guides too, which is useful after prompt improvements or when you want a fresh wiki pass.

`init` also supports `--dry-run` to preview work without writing files.

### `check`

Reports missing or stale guides in the current folder scope: the current folder, descendants, and ancestors up to the repo root. It exits with code `1` when guides need attention, which makes it suitable for CI.

### `update`

Regenerates stale guides in the same current-folder scope used by `check`. Child guides are processed before parent guides so higher-level pages can use fresh child context.

`update` supports `--dry-run` to report planned updates without writing files.

### `site`

Generates a static HTML wiki from existing `guide.md` files. By default it writes `repoguide-site/index.html` at the repo root.

```sh
repoguide site
repoguide site --out docs/repoguide --title "Project Wiki"
```

The generated page is self-contained: it includes inline CSS and JavaScript for navigation, search, and theme switching.

### `estimate`

Estimates input tokens, reserved output tokens, folder count, and the largest prompt candidates without calling an LLM. Use this before `init` on a large repo.

## What Gets Sent To The LLM

Only Git-tracked files are considered. Untracked files are ignored.

`repoguide` excludes generated `guide.md` files from source prompts, but it may include child guide contents when generating a parent guide. This helps parent pages summarize already-documented subtrees.

Use `.guideignore` at the repository root to exclude tracked files from guide generation:

```gitignore
dist/
*.snap
fixtures/large/**
!fixtures/large/README.md
```

`.guideignore` uses Gitignore-style patterns. The `.guideignore` file itself is treated as tool configuration, not source context.

## Output And Exit Codes

Generation commands print progress before each provider call, for example `init [1/8] creating src/core` or `update [1] regenerating src`.

- `0`: command completed successfully.
- `1`: `check` found guides needing attention, or generation finished with one or more folder failures.
- `2`: command error, such as running outside a Git repo or missing required generation config.

Errors go to stderr. Normal reports go to stdout. Secrets are not printed in diagnostics.

## Development

```sh
npm install
npm run build
npm test
npm run coverage
npm run pack:smoke
```

The package entry point is `dist/cli.js`, generated from `src/cli.ts`.
