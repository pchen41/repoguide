Tool to generate docs (called guide.md files, think wikis) for code repos. Read tasks.md before implementation, and update progress.md when changing task status.

To headlessly run other agents via command line:

claude:
env -u CLAUDECODE claude -p "prompt" --dangerously-skip-permissions

Unset CLAUDECODE so the subprocess does not treat itself as a nested Claude Code session.

codex:
codex exec --full-auto --skip-git-repo-check "prompt"

gemini:
gemini -m gemini-3.1-pro-preview --p "prompt"
