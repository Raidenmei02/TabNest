# TabNest (MVP)

A minimal VS Code extension that organizes opened editors into logical groups shown only in Explorer (`TabNest Groups` view).

## Commands

- `TabNest: Organize Open Editors`
- `TabNest: AI Auto Organize`
- `TabNest: Move Active Editor To Group`
- `TabNest: Move Open Editor To Group`
- `TabNest: Remove Open Editor From Group`
- `TabNest: Add Group`
- `TabNest: Delete Group`
- `TabNest: Search Open Editors`
- `TabNest: Clear Search`

## Drag into groups

- Open Explorer and use the `TabNest Groups` view.
- Drag an opened file item to another group node to re-assign its logical group.
- Drag files from Explorer into a group node to assign them into that logical group.
- These groups are visualized only in `TabNest Groups` and do not create VS Code editor splits.

## Settings

- `tabNest.autoOrganize`: enable automatic organization on tab changes.
- `tabNest.strategy`: `preset` or `custom`.
- `tabNest.debounceMs`: debounce interval in ms for auto mode.
- `tabNest.rules`: regex routing rules (used only in `custom` mode), each with 1-based `targetGroup`.
- `tabNest.aiEnabled`: enable AI fallback classification for files not matched by rules.
- `tabNest.aiApiKey`: API key used for AI classification requests.
- `tabNest.aiModel`: model used for classification (default `gpt-4.1-mini`).
- `tabNest.aiBaseUrl`: API base URL (default `https://api.openai.com/v1`).
- `tabNest.aiTimeoutMs`: timeout per AI request in milliseconds.
- `tabNest.aiSystemPrompt`: system prompt used by AI classifier.
- `tabNest.aiUserPromptTemplate`: user prompt template, supports `{{path}}`.
- `tabNest.aiAllowFileContent`: allow AI workflow to read short file content previews.
- `tabNest.aiContentPreviewChars`: max chars per file for content preview.
- `tabNest.aiMaxGroups`: max number of groups AI can create in AI Auto Organize.
- `tabNest.confirmDeleteGroup`: whether deleting a custom group asks for confirmation.

## Prompt examples

- system prompt (strict):
  `Classify file paths into exactly one token: project, tests, docs, temp. Reply with only one token.`
- user prompt template (path first):
  `Path: {{path}}\nChoose one token only: project | tests | docs | temp`
- user prompt template (docs-biased):
  `Path: {{path}}\nIf path is markdown, docs folder, ADR, RFC, or guide, choose docs. Otherwise choose the best token among project/tests/docs/temp.`

## AI run visibility

- During organize, status bar shows: `TabNest: organizing...`
- After organize, status bar shows one of:
  - `TabNest AI: not called`
  - `TabNest AI: missing key`
  - `TabNest AI: api X, cache Y, fail Z`
- Detailed per-run stats are written to Output panel channel: `TabNest`.
- Logs now include failure reason details:
  - `reason_counts=disabled/missing_key/cache_hit/api_success/api_failed/invalid_response`
  - `ai_failure_samples` lines with `target`, plus `status/error/response/model/base`.

## AI workflow (AI Auto Organize)

- `TabNest: AI Auto Organize` now uses a workflow:
  - Reads open editor file paths and file names.
  - Optionally reads short file content previews (`tabNest.aiAllowFileContent`).
  - Asks AI to create group names and assign each file to one group.
  - Creates missing groups automatically and applies assignments.

## Preset Strategy

When `tabNest.strategy = preset`, files are grouped like this:

- Group 1: project files (default, unmatched)
- Group 2: tests (`test/`, `__tests__/`, `*.test.*`, `*.spec.*`, etc.)
- Group 3: docs (`docs/`, `guide/`, `*.md`, `*.mdx`, etc.)
- Group 4: temp (`untitled`, `tmp/`, `scratch/`, `*.tmp`, `*.log`, etc.)

## Run locally

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch Extension Development Host.
