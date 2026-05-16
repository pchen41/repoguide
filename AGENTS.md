Tool to generate docs (called guide.md files, think wikis) for code repos. See tasks.md for implementation steps and progress.md for current progress. 

To run other agents via command line:

claude:
env -u CLAUDECODE claude -p "prompt" --dangerously-skip-permissions

codex:
codex exec --full-auto --skip-git-repo-check "prompt"

gemini:
gemini -m gemini-3.1-pro-preview --p "prompt"