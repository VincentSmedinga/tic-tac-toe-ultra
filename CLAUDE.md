@AGENTS.md

<!-- AGENTS.md is the source of truth for how we work: edit that file, not this one.
     Claude Code specifics, if any, go below. -->

## Claude Code

- You're the author of your commits and pull requests ("Authors" in AGENTS.md). `.claude/settings.json` makes you the author of every commit you make. On GitHub you're the `smedinga-claude` GitHub App: run `git push` and every `gh` command that writes (pull requests, comments, issue edits) through `/Volumes/Code/family/bin/as-claude`, like `as-claude gh pr create --reviewer VincentSmedinga`. Plain `gh` and the GitHub connector act as Vincent: use them to read, and to add issues and pull requests to the project board, which the app can't reach. Never open a pull request with them.
