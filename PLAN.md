# docdoc — Implementation Plan

## Current State

91 tests passing. Phase 2 is complete: the `generate`, `generateFile` commands and the
lightbulb code action provider are all implemented and tested. Phase 3 (update + convert) is
complete: docstring parsing, merge/render logic, all four commands, and fixture-based integration
tests. No config is read yet; all builders use hardcoded Google style.

---

## Phase 1 — Parser Completeness ✅

- [x] Multi-line signatures
- [x] `*args`/`**kwargs` prefix preserved in Args section label
- [x] Generator detection → `Yields:` instead of `Returns:`
- [x] Tests for all three

---

## Phase 2 — Generate + Code Action ✅

- [x] `generate` command (`src/commands.ts`) — inserts a docstring at cursor via `WorkspaceEdit`
- [x] `generateFile` command (`src/commands.ts`) — inserts docstrings for every undocumented
  `def`/`class` in the document
- [x] `CodeActionProvider` (`src/codeAction.ts`) — lightbulb quick fix for undocumented functions
- [x] Commands and provider registered in `extension.ts`
- [x] Unit tests in `src/test/unit/commands.test.ts` (hasDocstring, buildGoogleDocstringText,
  generateFileInsertions, applyInsertions)
- [x] Integration tests in `src/test/integration/generateFile.test.ts` — fixture-driven,
  auto-discovers all `*.input.py` / `*.expected.py` pairs

---

## Phase 3 — Update + Convert ✅

Depends on Phase 2. Requires parsing existing docstrings back into structured data.

### 3a — Docstring parser (`src/docstringParser.ts`) ✅

- [x] `ParsedDocstring`, `ParsedDocstringParam`, `ParsedDocstringRaise`, `DocstringParseResult` types
- [x] `parseGoogleDocstring(lines, openingLine)` — one-liners, multi-line, all sections
  (Args/Returns/Yields/Raises), continuation lines, bracket-aware colon split, single-quote
  delimiters, unknown sections preserved verbatim
- [x] 27 unit tests in `src/test/unit/docstringParser.test.ts`

### 3b — Update logic (`src/parser.ts` additions) ✅

- [x] `mergeDocstring(sig, existing, opts)` — sig-authoritative param list, descriptions
  carried over, `removeStaleParams` option, Returns/Yields updated from sig
- [x] `renderGoogleDocstring(parsed, indent, quoteChar)` — serialises back to plain text;
  one-liner when no sections; handles multi-line descriptions and unknown sections
- [x] `buildUpdateText(lines, defLine, opts?)` — finds existing docstring, parse → merge →
  render, returns `{ text, startLine, endLine }` for `WorkspaceEdit.replace`
- [x] 30 unit tests added to `src/test/unit/docstringParser.test.ts` (mergeDocstring × 10,
  renderGoogleDocstring × 9, buildUpdateText × 6)

### 3c — Update + Convert commands (`src/commands.ts` additions) ✅

- [x] `update(editor)` — replaces the docstring at cursor using `buildUpdateText` via
  `WorkspaceEdit.replace`
- [x] `updateFile(editor)` — applies update to every documented def/class in the file in a
  single `WorkspaceEdit`
- [x] `convert(editor)` — re-renders the docstring at/above the cursor in normalised Google
  style (round-trip via `parseGoogleDocstring` → `renderGoogleDocstring`)
- [x] `convertFileFormat(editor)` — applies convert to every docstring in the file
- [x] All four commands registered in `extension.ts`

### 3d — Integration tests ✅

- [x] `src/test/fixtures/update.input.py` — 7 documented functions with stale signatures
  (added param, removed param, changed return type, `None` return suppression, one-liner
  gaining a param, unknown section preservation, method inside class)
- [x] `src/test/fixtures/update.expected.py` — generated from the pure transform
- [x] `src/test/integration/updateFile.test.ts` — fixture-driven test; auto-discovers
  `*.update-input.py` pairs and handles the plain `update.input.py` / `update.expected.py` pair

---

## Phase 4 — On-Save Handler ✅

Depends on `generateFile` from Phase 2.

- [x] **`src/onSave.ts`** — on `onDidSaveTextDocument`, if `onSave.enable` is true, runs
  `generateFileInsertions` and applies all insertions via `WorkspaceEdit`. Skips non-Python
  files and files where every def/class is already documented. Registered in `extension.ts`
  via `registerOnSaveHandler(context)`.

---

## Phase 5 — Config Integration

Wire up all the settings declared in `package.json`. Applies retroactively to all earlier phases.

- [ ] **`src/config.ts`** — typed wrapper around `vscode.workspace.getConfiguration` returning a
  `DocstringOptions` struct.
- [ ] Options to wire: `format`, `quoteStyle`, `includeTypesFromAnnotations`, `includeDefaults`,
  `returns.mode`, `placeholders.summary`, `placeholders.description`, `onSave.enable`,
  `generateModuleDocstring`.
- [ ] `generateModuleDocstring`: when true, `generateFileInsertions` inserts a module-level
  docstring if the file does not already begin with one (stub TODO already in parser.ts).
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
- [ ] `generateModuleDocstring` implementation (stub already in parser.ts).

---

## Stretch Goals

- Subprocess-based precise raises analysis using the workspace Python interpreter.
- `mergeInitParams`: hoist `__init__` params into the class-level docstring.
- Dataclass `Attributes:` section.
- AI generation via VS Code LM API.

---

## File Map

| File                                        | Status        | Role                                                                                                   |
| ------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `src/parser.ts`                             | exists        | Pure logic: sig parsing, docstring building, file insertions                                           |
| `src/trigger.ts`                            | exists        | Inline completion provider (vscode adapter)                                                            |
| `src/extension.ts`                          | exists        | Activation, provider/command registration                                                              |
| `src/commands.ts`                           | exists        | `generate`, `generateFile` (Phase 2); `update`, `updateFile`, `convert`, `convertFileFormat` (Phase 3) |
| `src/codeAction.ts`                         | exists        | Lightbulb code action provider                                                                         |
| `src/docstringParser.ts`                    | exists        | Parse existing docstring sections; merge logic; render                                                 |
| `src/onSave.ts`                             | exists        | On-save trigger                                                                                        |
| `src/config.ts`                             | **to create** | Typed config reader                                                                                    |
| `src/test/unit/parser.test.ts`              | exists        | Sig parsing, builders, file insertions                                                                 |
| `src/test/unit/commands.test.ts`            | exists        | hasDocstring, buildGoogleDocstringText, generateFileInsertions, applyInsertions                        |
| `src/test/unit/docstringParser.test.ts`     | exists        | parseGoogleDocstring, mergeDocstring, renderGoogleDocstring, buildUpdateText                           |
| `src/test/integration/generateFile.test.ts` | exists        | Fixture-driven generate tests                                                                          |
| `src/test/integration/updateFile.test.ts`   | exists        | Fixture-driven update tests                                                                            |
| `src/test/fixtures/basic.input.py`          | exists        | Input for generate integration test                                                                    |
| `src/test/fixtures/basic.expected.py`       | exists        | Expected output for generate integration test                                                          |
| `src/test/fixtures/update.input.py`         | exists        | Input for update integration test (stale docstrings)                                                   |
| `src/test/fixtures/update.expected.py`      | exists        | Expected output for update integration test                                                            |

