# TabNest

TabNest is a VS Code extension that organizes opened editors into logical groups in Explorer view (`TabNest Groups`).

It does not create VS Code split editor groups. Grouping is a logical layer for navigation and focus.

## Features

- Logical groups with one built-in group: `Ungrouped`.
- Folder-like hierarchy inside each logical group.
- Search in `TabNest Groups` by filename or path keywords.
- Drag and drop support:
  - Drag editor items between TabNest groups.
  - Drag files from Explorer into a TabNest group.
- Persisted custom groups and assignments in workspace state.

## Commands

- `TabNest: Organize Open Editors`
- `TabNest: AI Auto Organize`
- `TabNest: Move Active Editor To Group`
- `TabNest: Move Open Editor To Group`
- `TabNest: Remove Open Editor From Group`
- `TabNest: Add Group`
- `TabNest: Rename Group`
- `TabNest: Delete Group`
- `TabNest: Search Open Editors`
- `TabNest: Clear Search`

## Group Management

- `Ungrouped` is built-in and cannot be renamed or deleted.
- Deleting a custom group moves its files back to `Ungrouped`.
- Group rename enforces non-empty and unique names.

## Organization Modes

### 1) Rule-based organize

Run `TabNest: Organize Open Editors`.

- Rules come from:
  - `tabNest.strategy = preset` (built-in rules), or
  - `tabNest.strategy = custom` with `tabNest.rules`.
- Files that do not match rules can optionally use AI fallback classification (if enabled).

### 2) AI workflow organize

Run `TabNest: AI Auto Organize`.

- Collects open files (path + label).
- Optionally reads short file content previews.
- Asks AI to propose group names and per-file assignments.
- Creates missing groups automatically and applies assignments.

## Preset Strategy

When `tabNest.strategy = preset`, built-in rule targets are:

- Group 1: `Ungrouped` (default for unmatched files)
- Group 2: tests (`test`, `tests`, `__tests__`, `*.test.*`, `*.spec.*`)
- Group 3: docs (`doc`, `docs`, `guide`, `adr`, `*.md`, `*.mdx`, `*.rst`, `*.txt`)
- Group 4: temp (`untitled:`, `tmp`, `temp`, `scratch`, `draft`, `*.tmp`, `*.log`)

## Settings

General:

- `tabNest.autoOrganize` (`boolean`, default: `false`)
- `tabNest.strategy` (`preset | custom`, default: `preset`)
- `tabNest.debounceMs` (`number`, default: `800`, minimum: `200`)
- `tabNest.rules` (`RuleConfig[]`, used only when strategy is `custom`)
- `tabNest.confirmDeleteGroup` (`boolean`, default: `true`)

AI:

- `tabNest.aiEnabled` (`boolean`, default: `false`)
- `tabNest.aiApiKey` (`string`, default: empty)
- `tabNest.aiModel` (`string`, default: `gpt-4.1-mini`)
- `tabNest.aiBaseUrl` (`string`, default: `https://api.openai.com/v1`)
- `tabNest.aiAuthMode` (`bearer | api-key | x-api-key`, default: `bearer`)
- `tabNest.aiTimeoutMs` (`number`, default: `8000`, minimum: `1000`)
- `tabNest.aiSystemPrompt` (`string`)
- `tabNest.aiUserPromptTemplate` (`string`, supports `{{path}}`)
- `tabNest.aiAllowFileContent` (`boolean`, default: `false`)
- `tabNest.aiContentPreviewChars` (`number`, default: `500`, range: `100-4000`)
- `tabNest.aiMaxGroups` (`number`, default: `6`, range: `2-12`)

## AI Status and Logs

- During organize, status bar shows running progress and counters.
- After organize, status bar summarizes:
  - tabs seen
  - rule matches
  - AI checked / assigned / success / cache / failures
- Output channel `TabNest` includes detailed run logs, including reason counts and failure samples.

## Local Development

```bash
npm install
npm run compile
```

Optional watch mode:

```bash
npm run watch
```

Then press `F5` in VS Code to launch Extension Development Host.
