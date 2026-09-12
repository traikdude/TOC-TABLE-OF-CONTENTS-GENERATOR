# AGENTS.md — Operating Rules for AI Agents (Jules, etc.)

## Hard rules — never violate
- NEVER delete files, directories, or large code blocks unless the task explicitly names them. When unsure, leave it and note it in the PR.
- NEVER modify application/business logic, public APIs, or rename files unless the task explicitly asks. Default scope is docs + metadata only.
- NEVER commit secrets. Use `.env.example` with placeholder values only.
- Keep every change on a branch + PR. Never push to `main`.

## Working style
- Propose a plan and wait for approval before editing.
- Keep diffs minimal and scoped to the stated task.
- Infer features from the ACTUAL code — never invent capabilities.
- In the PR description, list exactly what changed and why, and call out anything you intentionally did NOT touch.

## Project standard
- READMEs follow the "Aegis Standard": one-line description, Features, Install & Usage (real commands), Tech Stack. Professional, not generic.