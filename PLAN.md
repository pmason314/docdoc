# docdoc — Implementation Plan

## Current State

The triple-quote inline completion trigger works end-to-end: typing `"""` or `'''` after a
`def`/`class` produces Google-style ghost text with tab-completable placeholders. Multi-line
signatures, `*args`/`**kwargs` prefix display, and generator detection (`Yields:`) are all
implemented. 63 unit tests pass. No config is read, no commands are implemented, no other
formats exist.

---

## Phase 1 — Parser Completeness ✅

- [x] Multi-line signatures
- [x] `*args`/`**kwargs` prefix preserved in Args section label
- [x] Generator detection → `Yields:` instead of `Returns:`
- [x] Tests for all three

---

## Phase 2 — Generate + Code Action

First useful commands. Uses hardcoded Google style (no config yet).

- [ ] **`src/commands.ts`** — `generate` command: find the signature at cursor, build a docstring,
  insert it via `WorkspaceEdit` on the line after the `def`/`class`.
- [ ] **`src/commands.ts`** — `generateFile` command: scan every `def`/`class` in the document
  that lacks a docstring and insert one for each.
- [ ] **`src/codeAction.ts`** — `CodeActionProvider` that detects undocumented functions in the
  visible range and offers a "Generate docstring" lightbulb quick fix.
- [ ] Register commands and provider in `extension.ts`.
- [ ] Tests for undocumented-function detection and insertion logic.

---

## Phase 3 — Update + Convert

Depends on Phase 2. Requires parsing existing docstrings.

- [ ] **`src/docstringParser.ts`** — parse sections out of an existing Google-style docstring
  (params list, returns entry). Extend to NumPy/Sphinx in Phase 5.
- [ ] `update` command: merge the current signature with the existing docstring — add new params,
  remove stale entries (per `update.removeStaleParams` config).
- [ ] `updateFile` command: apply `update` to every documented function in the file.
- [ ] `convert` command: re-render an existing docstring in the target format (Google-only for
  now; extended in Phase 5).
- [ ] `convertFileFormat` command: apply `convert` file-wide.
- [ ] Tests for merge logic, stale param removal, and round-trip conversion.

---

## Phase 4 — On-Save Handler

Depends on `generateFile` from Phase 2.

- [ ] **`src/onSave.ts`** — on `onDidSaveTextDocument`, if `onSave.enable` is true, run the
  generate-file logic.

---

## Phase 5 — Config Integration

Wire up all the settings declared in `package.json`. Applies retroactively to all earlier phases.

- [ ] **`src/config.ts`** — typed wrapper around `vscode.workspace.getConfiguration` returning a
  `DocstringOptions` struct.
- [ ] Options to wire: `quoteStyle`, `includeTypesFromAnnotations`, `includeDefaults`,
  `returns.skipNone`, `returns.requireAnnotation`, `detectGenerators`, `placeholders.summary`,
  `placeholders.description`, `update.removeStaleParams`, `onSave.enable`.
- [ ] Thread `DocstringOptions` through all builder and command functions.
- [ ] Trigger and commands read config on each invocation (no caching).

---

## Phase 6 — NumPy and Sphinx Format Builders

Depends on Phase 5 (`format` config option).

- [ ] `buildNumpyDocstring` in `src/parser.ts`.
- [ ] `buildSphinxDocstring` in `src/parser.ts`.
- [ ] Trigger and commands dispatch to the correct builder based on `format` config.
- [ ] Extend `docstringParser.ts` to parse NumPy and Sphinx sections.
- [ ] Tests for both builders and parsers.

---

## Phase 7 — Advanced (lower priority)

- [ ] Raises detection: scan function body for `raise X` tokens → emit `Raises:` section.
- [ ] Dataclass `Attributes:` section (`includeClassAttributes` config).
- [ ] `mergeInitParams`: hoist `__init__` params into the class-level docstring.
- [ ] AI generation via VS Code LM API (`ai.*` config group).

---

## File Map

| File                                    | Status        | Role                                                                               |
| --------------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| `src/parser.ts`                         | exists        | Pure logic: parsing, snippet building                                              |
| `src/trigger.ts`                        | exists        | Inline completion provider (vscode adapter)                                        |
| `src/extension.ts`                      | exists        | Activation, provider/command registration                                          |
| `src/commands.ts`                       | **to create** | `generate`, `generateFile`, `update`, `updateFile`, `convert`, `convertFileFormat` |
| `src/codeAction.ts`                     | **to create** | Lightbulb code action provider                                                     |
| `src/docstringParser.ts`                | **to create** | Parse existing docstring sections                                                  |
| `src/onSave.ts`                         | **to create** | On-save trigger                                                                    |
| `src/config.ts`                         | **to create** | Typed config reader                                                                |
| `src/test/unit/parser.test.ts`          | exists        | 63 tests                                                                           |
| `src/test/unit/commands.test.ts`        | **to create** | Command logic tests                                                                |
| `src/test/unit/docstringParser.test.ts` | **to create** | Docstring parsing tests                                                            |
