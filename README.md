# repoguide

`repoguide` generates committed `guide.md` files for folders in a Git repository. A guide is a lightweight wiki page for humans and useful navigation context for LLMs.

## Setup

Use Node.js 26.x. Configure generation with environment variables or a repo-root `.env` file loaded by Node's built-in `.env` support:

```env
OPENAI_API_KEY=sk-...
REPOGUIDE_MODEL=gpt-5.1
REPOGUIDE_PROVIDER=openai
REPOGUIDE_MAX_FILE_BYTES=50000
```

Shell environment variables take precedence over `.env`. `check` and `estimate` do not require an API key.

## Ignore Source Files

Add a repo-root `.guideignore` to exclude tracked source files from guide generation:

```gitignore
dist/
*.snap
fixtures/large/**
!fixtures/large/README.md
```

`guide.md` files and `.guideignore` are excluded from source-file prompts. Child guide contents may be used when generating a parent guide.

## Commands

```sh
repoguide init
repoguide check
repoguide update
repoguide estimate init
repoguide estimate update
```

`init` bootstraps the whole repository bottom-up and skips existing guides. `update` works from the current folder scope: the current folder, descendants, and ancestors up to the repo root.
