# Python Docstring Generator — Implementation Plan

## Overview

The implementation is organized into eight phases. Each phase produces independently testable, shippable increments. Phases 1–5 constitute a v1.0 release. Phases 6–8 are post-v1.0.

```
Phase 1 │ Scaffolding & Tooling
Phase 2 │ Core Types, Config & Format Detection
Phase 3 │ Tree-sitter Parser
Phase 4 │ Format Renderers
Phase 5 │ Triggers & Commands          ← v1.0
Phase 6 │ Docstring Parser & Update Flow
Phase 7 │ Python Subprocess (Raises)
Phase 8 │ AI Assistance & Format Conversion
```

Dependencies flow strictly downward: no phase imports from a later one. The parser (Phase 3), renderers (Phase 4), and config (Phase 2) are kept completely free of VS Code API imports, making them independently unit-testable.

---

## Phase 1 — Scaffolding & Tooling

**Goal:** A working, publishable (empty) extension with the full build, test, and lint pipeline in place.

### 1.1 Project Initialization

- Run `yo code` with the TypeScript template to scaffold the extension.
- Rename the generated extension ID to `python-docstring-generator` (or similar; confirm no Marketplace conflict).
- Replace `webpack` with `esbuild` for bundling:
  - Add `esbuild` dev dependency.
  - Write `esbuild.mjs` with separate `development` and `production` configs.
  - Update `package.json` scripts: `compile`, `watch`, `package`, `vscode:prepublish`.
- Add `.vscodeignore` to exclude source, tests, and config files from the packaged `.vsix`.

### 1.2 TypeScript Configuration

- Set `"strict": true` in `tsconfig.json`.
- Set `"target": "ES2022"` and `"module": "Node16"`.
- Add a separate `tsconfig.test.json` that includes `src/test/**`.

### 1.3 Linting & Formatting

- Add ESLint with `@typescript-eslint/recommended`.
- Add Prettier; configure to match ESLint (no rule conflicts).
- Add `lint-staged` + `husky` pre-commit hook running ESLint and Prettier on staged files.

### 1.4 Test Harness

- Configure `@vscode/test-cli` (the modern replacement for `vscode-test`) for integration tests.
- Configure `mocha` + `chai` for unit tests that run outside the extension host (no VS Code API).
- Add `c8` for coverage reporting.
- Add scripts: `test:unit`, `test:integration`, `test` (runs both).
- Create placeholder test files to confirm the pipeline is wired correctly.

### 1.5 CI Pipeline

- Add a GitHub Actions workflow (`ci.yml`) that runs on push and pull request:
  - `npm ci`
  - `npm run lint`
  - `npm run test:unit`
  - `npm run test:integration` (using `xvfb-run` for headless VS Code)
  - `npm run package` (confirms the `.vsix` builds without error)
- Add a separate `publish.yml` workflow triggered on version tags that runs `vsce publish` and `ovsx publish`.

### 1.6 Extension Manifest (`package.json`)

Declare all contributions up front so they exist in the manifest from the start, even before the implementations are wired:

- `contributes.commands` — all six commands from FEATURES.md.
- `contributes.configuration` — all settings from FEATURES.md with correct types, defaults, and descriptions.
- `contributes.keybindings` — empty (no defaults, user-assignable only).
- `activationEvents` — `onLanguage:python`.
- `engines.vscode` — set to the minimum version that includes the LM Chat Provider API (≥ 1.104.0).

**Telemetry:** The extension collects no telemetry, usage metrics, or content logs. The `package.json` should *not* include a telemetry reporter dependency. No participation in VS Code's telemetry infrastructure.

### Deliverable
A `.vsix` that installs and activates on a Python file, with all commands visible in the palette (no-ops for now) and all settings visible in the Settings UI.

---

## Phase 2 — Core Types, Config & Format Detection

**Goal:** A stable shared type system and a config module that resolves the active format, Ruff style rules, and interpreter path. No VS Code API dependencies in this phase.

### 2.1 Core Type Definitions (`src/types.ts`)

```typescript
export type ParamKind =
  | "positional-only"
  | "regular"
  | "keyword-only"
  | "args"       // *args
  | "kwargs";    // **kwargs

export interface Param {
  name: string;
  kind: ParamKind;
  annotation: string | null;   // raw text from source
  default: string | null;      // raw text from source
  isOptional: boolean;
}

export interface TypeParam {               // PEP 695 [T, S: str]
  name: string;
  bound: string | null;
  variance: "TypeVar" | "TypeVarTuple" | "ParamSpec";
}

export interface FunctionInfo {
  name: string;
  params: Param[];
  returnAnnotation: string | null;
  decorators: string[];
  isAsync: boolean;
  isGenerator: boolean;
  typeParams: TypeParam[];
  docstring: string | null;       // existing docstring text, if any
  bodyRange: Range;               // VS Code Range of the function body
  signatureRange: Range;          // VS Code Range of the full signature
  scopeLevel: "module" | "class" | "function";
}

export interface ClassInfo {
  name: string;
  decorators: string[];
  typeParams: TypeParam[];
  attributes: ClassAttribute[];
  initParams: Param[];            // populated when mergeInitParams is true
  docstring: string | null;
  bodyRange: Range;
  signatureRange: Range;
}

export interface ClassAttribute {
  name: string;
  annotation: string | null;
  isClassVar: boolean;
}

export type DocstringTarget = FunctionInfo | ClassInfo;

export type DocstringFormat = "google" | "numpy" | "sphinx";

export interface ParsedDocstring {
  format: DocstringFormat | null;
  summary: string;
  extendedSummary: string | null;
  params: ParsedParam[];
  returns: ParsedReturn | null;
  yields: ParsedReturn | null;
  raises: ParsedRaise[];
  attributes: ParsedAttribute[];
  customSections: CustomSection[];
  quoteStyle: "double" | "single";
  startOnNewLine: boolean;
}

// ... (ParsedParam, ParsedReturn, ParsedRaise, ParsedAttribute, CustomSection)

export interface Config {
  format: DocstringFormat;
  quoteStyle: "double" | "single";
  includeTypesFromAnnotations: boolean;
  includeDefaults: boolean;
  includeExtendedSummary: boolean;
  returns: {
    skipNone: boolean;
    requireAnnotation: boolean;
  };
  detectGenerators: boolean;
  raises: {
    useSubprocess: boolean;
    useSimpleScan: boolean;
  };
  mergeInitParams: boolean;
  includeClassAttributes: boolean;
  update: {
    removeStaleParams: boolean;
  };
  placeholders: {
    summary: string;
    description: string;
  };
  pythonPath: string;
  ai: {
    generateSummary: boolean;
    generateParamDescriptions: boolean;
    generateReturnDescription: boolean;
    includeBodyContext: boolean;
    maxBodyTokens: number;
    modelFamily: string;
  };
  ruff: {
    startOnNewLine: boolean;    // resolved from ruff config
    collapseOneLiners: boolean; // resolved from ruff config
  };
  trigger: {
    tripleQuote: boolean;
    codeAction: boolean;
  };
  onSave: {
    enable: boolean;
  };
}
```

### 2.2 Config Resolution (`src/config.ts`)

Reads VS Code workspace config and merges with pyproject.toml/ruff.toml detections. Has no VS Code API imports in its core logic — accepts a `vscode.WorkspaceConfiguration` object as a parameter so the core is testable.

**Format detection (`src/config/formatDetector.ts`)**

- Searches upward from the active file for `pyproject.toml`, then `ruff.toml`, then `setup.cfg`.
- Parses TOML using a bundled TOML parser (`@ltd/j-toml` or `smol-toml` — small, no native deps).
- Checks keys in order: `[tool.ruff.lint.pydocstyle].convention`, `[tool.pydocstyle].convention`, `[tool.pylint.format].docstring-convention`.
- Maps `pep257` → `google` (closest equivalent for generation purposes; noted in output).
- Returns `null` if nothing found; caller falls back to `"google"`.
- Fires `onDidChangeConfiguration` equivalent via a `FileSystemWatcher` on `**/pyproject.toml`.

**Ruff style detection (`src/config/ruffStyleDetector.ts`)**

- Reads `pyproject.toml` / `ruff.toml` for `[tool.ruff.lint]` select/ignore arrays.
- Resolves D200, D212, D213 rule presence.
- Returns `{ startOnNewLine: boolean, collapseOneLiners: boolean }`.
- These values feed into generation only — never used to reformat existing docstrings.

**Interpreter detection (`src/config/interpreterDetector.ts`)**

- Checks `docstringGenerator.pythonPath` setting first.
- Falls back to the `ms-python.python` extension API (`getActiveEnvironmentPath()`).
- Falls back to `python3` / `python` on `$PATH`.
- Returns `null` if nothing is found; the subprocess analyzer gracefully degrades.

### 2.3 Unit Tests

For each detector: feed synthetic `pyproject.toml` content strings and assert the resolved config values. Zero VS Code API involvement.

### Deliverable
A fully typed, fully tested config module. All downstream phases import `Config` and `FunctionInfo`/`ClassInfo` from here.

---

## Phase 3 — Tree-sitter Parser

**Goal:** A `parse(documentText: string, position?: Position): DocstringTarget | null` function that reliably extracts `FunctionInfo` or `ClassInfo` at any cursor position, including module level. Zero VS Code API dependencies.

### 3.1 Tree-sitter Setup

- Add `web-tree-sitter` and `tree-sitter-python` (WASM build) as dependencies.
- Write `src/parser/treeSitter.ts` — a singleton that initializes the parser and language once, lazily, and caches the result. WASM loading is async; wrap in a promise that all callers await.
- Bundle the `.wasm` file via esbuild's `copy` loader so it ends up in `dist/`.
- Test that the WASM loads correctly in the extension host environment (integration test).

### 3.2 Signature Extraction (`src/parser/signatureExtractor.ts`)

Given a tree-sitter `SyntaxNode` for a `function_definition` or `class_definition`, extract:

**Parameters:**
- Walk `parameters` node children.
- Classify each child by node type: `identifier`, `typed_parameter`, `default_parameter`, `typed_default_parameter`, `list_splat_pattern` (`*args`), `dictionary_splat_pattern` (`**kwargs`), `positional_separator` (`/`), `keyword_separator` (`*`).
- Extract annotation from `type` child, default from `value` child, as raw source text.

**Return annotation:**
- Read `return_type` child of `function_definition`, if present.
- Strip surrounding whitespace; keep raw text.

**Decorators:**
- Walk preceding sibling nodes for `decorator` nodes; capture full text of each.

**Async / generator:**
- `isAsync`: check for `async` keyword sibling before `def`.
- `isGenerator`: scan the function body for any `yield` or `yield_from` expression node (shallow scan, not full recursion into nested functions).

**PEP 695 type params:**
- tree-sitter-python has full support for PEP 695: `function_definition` and `class_definition` both expose a `type_parameters` field containing a `type_parameter` node. `splat_type` handles `*Ts` / `**P`, and `constrained_type` handles bounds like `T: str`.
- Check for `type_parameter` child between name and `(` in `function_definition` / `class_definition`.
- Walk its children to extract `TypeVar`, `TypeVarTuple` (`*`), `ParamSpec` (`**`) nodes.

**Class attributes:**
- Walk `class_body` for `expression_statement` → `assignment` or `annotated_assignment` at the class scope level.
- Detect `ClassVar[...]` annotation wrapper.

**Existing docstring:**
- Check the first statement of the body for an `expression_statement` containing a `string`.
- If found, capture its text; this is the existing docstring.

### 3.3 Scope Resolution (`src/parser/scopeResolver.ts`)

Given a cursor position in the document:

- Walk the tree upward from the node at that position.
- Find the nearest `function_definition` or `class_definition` ancestor.
- If none exists, the target is module-level.
- Return the resolved `FunctionInfo`, `ClassInfo`, or a module-level sentinel.
- Handle multi-line signatures: if the cursor is inside a parameter list that spans multiple lines, still resolve to the owning function.
- Skip functions decorated with `@typing.overload` — these are stub signatures. Only the implementation (un-decorated) overload is a valid target for docstring generation.

### 3.4 Module-Level Detection

- A separate path for module-level docstring generation.
- If the file has no existing module docstring (first non-comment, non-blank statement is not a string literal), the module is a valid target.
- `FunctionInfo` equivalent for module level: no params, no return, no decorators; body range starts at line 0.

### 3.5 Edge Case Tests

Unit test suite covering (at minimum):

| Case                                          | Expected behavior                                              |
| --------------------------------------------- | -------------------------------------------------------------- |
| `def f(a=1, b)` (non-default after default)   | Warns, generates for valid params                              |
| `def f(**kwargs, *args)` (invalid order)      | Warns, generates for both                                      |
| Multi-line signature after Black formatting   | All params extracted correctly                                 |
| `def f(a, /, b, *, c)`                        | Positional-only and keyword-only classified correctly          |
| `def f[T, *Ts, **P]()`                        | TypeVar, TypeVarTuple, ParamSpec all extracted                 |
| `async def f()`                               | `isAsync: true`                                                |
| Generator with `yield` in nested function     | `isGenerator: false` (nested yield doesn't count)              |
| `@classmethod`, `@staticmethod`, `@property`  | Decorator captured; suppression handled upstream               |
| Class with `dataclass` decorator              | Attributes extracted                                           |
| Annotation `"ForwardRef"` (stringified)       | Captured as-is; unwrapping is Phase 7                          |
| Implicit string concat annotation             | Joined before return                                           |
| Module-level (cursor at top of file)          | Module sentinel returned                                       |
| Cursor inside existing docstring              | Still resolves to enclosing function                           |
| Broken/incomplete code                        | Returns best-effort result, no exception                       |
| Malformed parameter (ERROR node in signature) | Parameter skipped, warning diagnostic emitted                  |
| `@typing.overload` decorated function         | Skipped; docstring generated for implementation signature only |

### Deliverable
`parse(text, position)` passes all edge case tests. No VS Code API imports. Ready to be called from any downstream phase.

---

## Phase 4 — Format Renderers

**Goal:** Three pure functions, one per format, each taking a `DocstringTarget` + `Config` and returning a VS Code snippet string. Zero VS Code API dependencies.

### 4.1 Renderer Interface (`src/docstring/renderer.ts`)

```typescript
export interface Renderer {
  render(target: DocstringTarget, config: Config): string; // VS Code snippet syntax
}
```

All renderers implement this interface. A `getRenderer(format: DocstringFormat): Renderer` factory selects the right one.

### 4.2 Snippet Builder (`src/docstring/snippetBuilder.ts`)

A shared utility used by all renderers to build VS Code snippet strings correctly:

- `tabStop(n: number, placeholder?: string): string` — emits `${n:placeholder}` or `$n`.
- `finalCursor(): string` — emits `$0`.
- `$0` is placed at the end of the last description field in the docstring, so the cursor remains near the content the user was just editing after tabbing through all fields.
- Handles escaping of `$`, `\`, and `}` inside placeholder text.
- Handles indentation: takes the base indent level and inserts it consistently at each line.

All renderers use this; no renderer concatenates snippet syntax by hand.

### 4.3 Google Renderer (`src/docstring/formats/google.ts`)

Section order: summary → extended summary → Args → Returns/Yields → Raises → Attributes.

- Args section uses `name (type): description` format for each param.
- When `includeTypesFromAnnotations` is `false`, omits the `(type)` portion entirely.
- When `includeDefaults` is `true`, appends `Defaults to {default}.` to the description placeholder.
- `*args` / `**kwargs` entries appear as `*args` / `**kwargs` in the section.
- Returns section: `type: description` on one line.
- Raises section: `ExceptionType: description` per entry.
- Attributes section: same format as Args.

### 4.4 NumPy Renderer (`src/docstring/formats/numpy.ts`)

Section order: summary → extended summary → Parameters → Returns/Yields → Raises → Attributes.

- Uses `------` underlines sized to match the section header length exactly.
- Parameters: `name : type` header line, indented description on next line.
- Optional params get `, optional` appended to the type.
- Default value appears as `by default {default}` in the description.
- Returns: anonymous (no name), just `type` then indented description.
- Raises: `ExceptionType` then indented description.

### 4.5 Sphinx Renderer (`src/docstring/formats/sphinx.ts`)

- `:param name: description` and `:type name: type` as separate lines (when types enabled).
- `:returns: description` and `:rtype: type`.
- `:raises ExceptionType: description`.

### 4.6 Ruff Style Application

Each renderer delegates to a shared `applyRuffStyle(lines: string[], config: Config): string[]` function that:

- Applies `startOnNewLine`: moves the summary to a new line if needed.
- Applies `collapseOneLiners`: collapses to a single line if the docstring has only a summary and the rule is active.

This function operates on the already-rendered lines and is applied once, uniformly, regardless of format.

### 4.7 Renderer Tests

For each renderer, snapshot tests asserting the exact output for:

- Simple function with no params, no return.
- Function with positional, keyword-only, `*args`, `**kwargs`.
- Function with all annotation types present.
- Function with `includeTypesFromAnnotations: false`.
- Function with defaults and `includeDefaults: true` / `false`.
- Generator function (Yields section).
- Class with attributes.
- Module-level (no params/return, summary only).
- One-liner collapse active vs. inactive.
- `startOnNewLine` active vs. inactive.

### Deliverable
Three renderers that pass snapshot tests. The generator in the next phase is a thin orchestrator on top of these.

---

## Phase 5 — Triggers, Commands & VS Code Integration

**Goal:** All user-facing interactions working end-to-end: triple-quote trigger, command palette, code action, on-save. This is the v1.0 milestone.

### 5.1 Extension Entry Point (`src/extension.ts`)

- `activate(context)`: initializes the WASM parser (async, awaited before registering anything), sets up config watchers, registers all disposables.
- `deactivate()`: no-op (subprocess invocations are one-shot and need no teardown).
- All registrations go through `context.subscriptions` for correct cleanup.

### 5.2 Document Scanner (`src/vscode/documentScanner.ts`)

A thin VS Code-aware wrapper around the tree-sitter parser:

- `scanDocument(doc: TextDocument): DocstringTarget[]` — returns all functions, classes, and the module-level target in the document.
- `targetAtPosition(doc: TextDocument, pos: Position): DocstringTarget | null` — returns the target at the cursor.
- Used by triggers, commands, and the code action provider.

### 5.3 Triple-Quote Trigger (`src/vscode/tripleQuoteTrigger.ts`)

Registered as a `TextDocumentChangeListener`, not a `CompletionItemProvider`. Rationale: completions fire before the text is committed; change events fire after, giving a stable document state to parse.

Implementation:

1. On each change event, apply a **fast-path check**: only proceed if the changed text is exactly `"""` or `'''` (3 characters) and `trigger.tripleQuote` is enabled. All other edits are rejected immediately with no tree-sitter invocation. This is critical for performance since the listener fires on every keystroke, paste, and formatter run.
2. Check the character *before* the insertion: is the cursor immediately after a `def`/`class` block's opening brace line, or at the top of the file?
3. Call `targetAtPosition` to resolve the target.
4. If a target is found and has no existing docstring:
   - Generate the snippet.
   - Execute `editor.insertSnippet` after first deleting the typed delimiter (replace, not append).
5. If no target or docstring already exists, do nothing (let the `"""` stand as typed).

**Indentation:** the snippet's base indentation is taken from the column of the `"""` trigger character, not from any hardcoded constant. Module-level triggers at column 0 produce a docstring at column 0.

### 5.4 Commands (`src/vscode/commands.ts`)

Each command is a thin function that:

1. Checks a module-level `generationInProgress` flag. If set, returns immediately (prevents reentrancy from concurrent triggers, on-save, or rapid command invocations).
2. Sets the flag, wraps the remainder in a `try/finally` that clears it.
3. Gets the active editor and document.
4. Resolves the target (cursor position for single-target commands; full document scan for file-wide commands).
5. Calls the generator.
6. Inserts the result via `editor.insertSnippet` (single) or a single `WorkspaceEdit` (file-wide, so the entire operation is one atomic undo step).

**`docstringGenerator.generate`**
- If target has no docstring: generate and insert.
- If target has a docstring: delegate to the update flow (Phase 6). In Phase 5, show an information message: "Docstring already exists. Use Update Docstring to modify it."

**`docstringGenerator.generateFile`**
- Scan document for all targets with no docstring.
- Generate for each, applying edits in reverse document order (bottom-up) so earlier ranges stay valid.
- Show a progress notification: "Generating N docstrings…"
- Report how many were generated on completion.

**`docstringGenerator.update`** (stub in Phase 5, full in Phase 6)

**`docstringGenerator.updateFile`** (stub in Phase 5, full in Phase 6)

**`docstringGenerator.convertFormat`** (stub in Phase 5, full in Phase 8)

**`docstringGenerator.convertFileFormat`** (stub in Phase 5, full in Phase 8)

### 5.5 Code Action Provider (`src/vscode/codeActionProvider.ts`)

Registered via `vscode.languages.registerCodeActionsProvider` for `python`.

- `provideCodeActions(doc, range, context)`:
  - Check if the range intersects a function/class signature with no docstring → offer `Generate docstring` (Quick Fix).
  - Check if the range intersects a function/class signature with an existing docstring → offer `Update docstring` (Quick Fix).
  - Check if the range is at the top of the file with no module docstring → offer `Generate module docstring` (Quick Fix).
- Each code action runs the corresponding command via `vscode.commands.executeCommand`.
- Controlled by `trigger.codeAction` setting.

### 5.6 On-Save Handler (`src/vscode/onSaveHandler.ts`)

Registered via `vscode.workspace.onDidSaveTextDocument`.

- Checks `onSave.enable`; no-ops if false.
- Calls `scanDocument` to find all undocumented targets.
- Applies edits via `WorkspaceEdit` (not `editor.insertSnippet`, since the file may not be the active editor).
- Shows a progress notification during generation.
- Respects the module-level `generationInProgress` flag: if another operation is in progress, the on-save handler no-ops.

### 5.7 Config Watcher

- Watch `**/pyproject.toml` and `**/ruff.toml` via `vscode.workspace.createFileSystemWatcher`.
- On change, re-run format detection and Ruff style detection; update the in-memory config.
- Watch VS Code settings via `vscode.workspace.onDidChangeConfiguration`.

### 5.8 Integration Tests (Phase 5)

Using `@vscode/test-cli` with fixture Python files:

| Test                                                       | Assertion                                         |
| ---------------------------------------------------------- | ------------------------------------------------- |
| Type `"""` after `def f():`                                | Docstring snippet inserted at correct indentation |
| Type `"""` at top of file                                  | Module docstring inserted at column 0             |
| Type `"""` inside existing docstring                       | No action                                         |
| Run `generate` command on decorated function               | Snippet inserted, decorator handled               |
| Run `generateFile` on a file with 5 undocumented functions | 5 docstrings inserted                             |
| Code action lightbulb appears on `def` line                | Quick Fix present                                 |
| Code action lightbulb absent when docstring exists         | Quick Fix absent                                  |
| pyproject.toml present with `convention = "numpy"`         | NumPy format used                                 |

### Deliverable
**v1.0**: a fully functional extension covering generation across all three formats, all triggers, all commands (except update/convert), and pyproject.toml format detection.

---

## Phase 6 — Docstring Parser & Update Flow

**Goal:** Parse existing docstrings into `ParsedDocstring` and implement the full update flow.

### 6.1 Docstring Parser (`src/parser/docstringParser.ts`)

Takes the raw text of an existing docstring and returns a `ParsedDocstring`.

**Format detection:**
- Google: presence of `Args:`, `Returns:`, `Raises:` section headers followed by indented content.
- NumPy: presence of `---` underlines after section headers.
- Sphinx: presence of `:param`, `:type`, `:returns:`, `:rtype:` directives.
- Unknown: return `format: null`; triggers append-only update mode.

**Section parsing** for each format:
- Extract `summary` (first line after opening `"""`).
- Extract `extendedSummary` (lines between summary and first section header, if any).
- Parse each param entry: name, type (if present), description.
- Parse returns/yields entry.
- Parse each raises entry.
- Parse attributes section.
- Collect any unrecognized section headers and their content into `customSections` (preserved verbatim on update).

**Quote style and startOnNewLine:**
- Detect from the raw docstring text.
- Preserved on update.

### 6.2 Update Engine (`src/docstring/updater.ts`)

Takes a `DocstringTarget` (fresh from tree-sitter), `ParsedDocstring` (from the parser), and `Config`:

1. **Preserve:** copy summary, extendedSummary, custom sections, existing descriptions.
2. **Add:** for each param in the signature not present in the docstring, insert a new entry.
3. **Remove:** for each param in the docstring not present in the signature, remove if `removeStaleParams` is true.
4. **Sync types:** if `includeTypesFromAnnotations` is true, update type fields from the signature annotation. If false, strip type fields from all existing entries.
5. **Regenerate** the docstring using the renderer for the *existing* format (not the configured format). This preserves format even if the user changed the setting.

**Output:** a `ParsedDocstring` with the merged content → pass to the existing format's renderer → emit as plain text (not a snippet, since descriptions already exist; only newly added param slots are snippets).

### 6.3 Update Commands (complete)

**`docstringGenerator.update`**
- Parse existing docstring.
- Run update engine.
- Replace the existing docstring text in the editor with the updated text.

**`docstringGenerator.updateFile`**
- Scan document for all targets with existing docstrings.
- For each, parse + update.
- Apply all edits in a single `WorkspaceEdit` in reverse document order.
- Show progress and result count.

### 6.4 Update Tests

| Case                                           | Expected behavior                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Add new param to signature                     | New param entry appears in updated docstring                             |
| Remove param from signature                    | Entry removed when `removeStaleParams` is true; left in place when false |
| Rename param                                   | Old removed, new added; description for old is lost (expected)           |
| Change type annotation                         | Type field updated when `includeTypesFromAnnotations: true`              |
| `includeTypesFromAnnotations` changed to false | Existing type fields stripped                                            |
| Custom `Notes:` section                        | Preserved verbatim                                                       |
| Existing docstring is Google, config is NumPy  | Update uses Google format                                                |
| Unknown format docstring                       | Append-only: new params added, nothing removed                           |

### Deliverable
Full generate + update round-trip. The extension is now complete for non-AI, non-conversion workflows.

---

## Phase 7 — Python Subprocess (Raises Analysis)

**Goal:** Integrate the workspace Python interpreter for precise raises detection, with graceful degradation.

### 7.1 Subprocess Invocation (`src/python/subprocessInvoker.ts`)

- Invokes the workspace Python interpreter as a one-shot subprocess for each analysis request. The startup cost (~100ms) is negligible for user-initiated actions.
- Runs `python <analyzer.py> <args>` with JSON input piped via stdin and JSON output read from stdout.
- Handles process errors and non-zero exit codes: log, return `null`, and let the caller fall back to simple scan.
- `analyze(filePath: string, functionName: string, startLine: number): Promise<RaisesResult | null>`.

**Future optimization:** if profiling shows subprocess startup is a bottleneck (e.g., for file-wide operations analyzing many functions), this can be upgraded to a persistent process pool with stdin/stdout JSON framing. The interface is designed so this change would be internal to this module with no downstream impact.

### 7.2 Analyzer Script (`src/python/analyzer.py`)

A self-contained Python script bundled into the extension (under `dist/python/`). Must work on Python 3.9+.

```python
# Reads: {"file": "...", "function": "...", "start_line": N}
# Writes: {"raises": ["ValueError", "TypeError"], "error": null}
```

Uses `ast.parse` on the file, walks to the target function by line number, then:

- Visits all `ast.Raise` nodes in the function body.
- Classifies: bare `raise` (re-raise), `raise X()`, `raise X from Y`.
- Tracks `try/except` scope: raises inside an `except` block that are caught and not re-raised are excluded.
- Handles `except*` (Python 3.11+) via version check.
- Returns a deduplicated list of exception type names that escape the function.

### 7.3 Simple Scan Fallback (`src/parser/raisesScanner.ts`)

Uses tree-sitter to do a best-effort scan when no Python interpreter is available:

- Walk all `raise_statement` nodes in the function body.
- Extract the exception type name (first identifier of the raised expression).
- Does **not** perform try/except filtering — may over-report.
- Returns results annotated with `{ precise: false }` so the caller can note this in the docstring or UI.

### 7.4 Integration with Generator

The generator calls `subprocessInvoker.analyze()` if `raises.useSubprocess` is true and an interpreter is available. Falls back to `raisesScanner` if `raises.useSimpleScan` is true. If neither is available, the Raises section is omitted.

The result is injected into `FunctionInfo.raisedExceptions: string[]` before passing to the renderer.

### 7.5 Interpreter Acquisition

On first use, if no interpreter is found:

- Check if `ms-python.python` is installed; if so, prompt: "Python Docstring Generator needs a Python interpreter for raises analysis. Use the one selected by the Python extension?"
- If declined or the extension is absent, fall back gracefully and show a one-time information message explaining the limitation.
- Never block generation waiting for interpreter resolution.

### 7.6 Tests

| Case                                     | Expected behavior                       |
| ---------------------------------------- | --------------------------------------- |
| `raise ValueError("msg")`                | `["ValueError"]` returned               |
| `raise ValueError from exc`              | `["ValueError"]` returned               |
| `raise` inside `except TypeError` block  | `["TypeError"]` returned (re-raise)     |
| `except ValueError: pass`                | `ValueError` excluded                   |
| `except TypeError: raise RuntimeError()` | `["RuntimeError"]` returned             |
| `except* ValueError` (Python 3.11+)      | Handled without error                   |
| Nested function with `raise` inside it   | Not included in outer function's raises |
| Python interpreter unavailable           | Falls back to simple scan, no exception |

### Deliverable
Raises analysis working precisely when an interpreter is available, degrading gracefully to simple scan when not.

---

## Phase 8 — AI Assistance & Format Conversion

### 8.1 AI Assistance (`src/ai/aiAssistant.ts`)

**Model selection:**
- Call `vscode.lm.selectChatModels({ family: config.ai.modelFamily || undefined })`.
- If the result is empty (no compatible model available), return `null` silently — the caller falls back to placeholder text.
- Log a debug message (not a user-visible notification) when no model is found.

**Prompt construction (`src/ai/prompts.ts`):**

All prompts are assembled here and kept out of the assistant module so they can be unit-tested independently.

- Summary prompt: `"Write a single-sentence Python docstring summary for this function. Respond with only the sentence, no punctuation at the end.\n\n{signature}"`.
- Param description prompt: `"Describe the parameter '{name}' (type: {type}) of this Python function in one short phrase. Respond with only the phrase.\n\n{signature}"`.
- Return description prompt: `"Describe the return value (type: {type}) of this Python function in one short phrase. Respond with only the phrase.\n\n{signature}"`.
- When `includeBodyContext` is true and the body is within `maxBodyTokens`, append the body to each prompt.
- Prompts never include file-level or project-level context.

**Calling the LM:**
- Use `model.sendRequest(messages, {}, token)` with a `CancellationToken` tied to the command's lifetime.
- Handle `vscode.LanguageModelError` gracefully: log and fall back to placeholders.
- Parse the response: strip leading/trailing whitespace; truncate at the first newline (the model should return one line, but may not).

**Integration with the generator:**
- AI calls are made *before* snippet assembly, so the results can be used as tab stop placeholders.
- AI generation is async; show a progress indicator (`vscode.window.withProgress`) while waiting.
- The user can edit or replace AI-generated content since it's still a snippet with tab stops.

### 8.2 Format Conversion (`src/docstring/converter.ts`)

Takes a `ParsedDocstring` (from the Phase 6 parser) and a target `DocstringFormat`, and re-renders it using the target format's renderer.

**What is preserved through conversion:**
- Summary and extended summary.
- All param descriptions.
- Returns/yields description.
- Raises descriptions.
- Attribute descriptions.
- Custom sections (appended verbatim after the standard sections).

**What is adapted:**
- Section headers and delimiters (format-specific).
- Type field placement (inline for Google/NumPy, separate lines for Sphinx).
- Underlines (NumPy) added or removed as needed.

**Commands (complete):**

**`docstringGenerator.convertFormat`**
- Parse the existing docstring.
- If `format` is `null` (unknown), show an error: "Could not detect the existing docstring format."
- Re-render in the configured format.
- Replace the existing docstring text.

**`docstringGenerator.convertFileFormat`**
- Same, applied to every docstring in the file.
- Preview mode: open a diff editor showing before/after before applying.
- Apply via `WorkspaceEdit`.

### 8.3 Tests

**AI (unit tests using a mock LM):**
- Mock `vscode.lm.selectChatModels` to return a fake model.
- Assert that the correct prompts are sent for various function shapes.
- Assert that LM errors produce placeholder fallback output.
- Assert that `modelFamily` setting filters model selection correctly.
- Assert that body content is included/excluded based on `includeBodyContext` and token count.

**Format conversion (unit tests):**
- Round-trip each format to every other format and assert no content is lost.
- Assert custom sections are preserved verbatim.
- Assert that a docstring with `format: null` produces the appropriate error.

---

## Source Layout

```
python-docstring-generator/
├── src/
│   ├── extension.ts
│   ├── types.ts
│   ├── config/
│   │   ├── config.ts
│   │   ├── formatDetector.ts
│   │   ├── ruffStyleDetector.ts
│   │   └── interpreterDetector.ts
│   ├── parser/
│   │   ├── treeSitter.ts
│   │   ├── signatureExtractor.ts
│   │   ├── scopeResolver.ts
│   │   ├── docstringParser.ts
│   │   └── raisesScanner.ts
│   ├── docstring/
│   │   ├── generator.ts
│   │   ├── updater.ts
│   │   ├── converter.ts
│   │   ├── snippetBuilder.ts
│   │   └── formats/
│   │       ├── google.ts
│   │       ├── numpy.ts
│   │       └── sphinx.ts
│   ├── python/
│   │   ├── subprocessInvoker.ts
│   │   └── analyzer.py
│   ├── ai/
│   │   ├── aiAssistant.ts
│   │   └── prompts.ts
│   └── vscode/
│       ├── documentScanner.ts
│       ├── tripleQuoteTrigger.ts
│       ├── codeActionProvider.ts
│       ├── commands.ts
│       └── onSaveHandler.ts
├── test/
│   ├── unit/
│   │   ├── parser/
│   │   ├── docstring/
│   │   ├── config/
│   │   └── ai/
│   └── integration/
│       └── fixtures/
│           ├── simple.py
│           ├── decorated.py
│           ├── multiline_sig.py
│           ├── pep695.py
│           ├── generators.py
│           └── module_level.py
├── dist/
│   └── python/
│       └── analyzer.py         (copied by esbuild)
├── esbuild.mjs
├── package.json
├── tsconfig.json
├── tsconfig.test.json
├── .eslintrc.json
├── .prettierrc
├── FEATURES.md
└── PLAN.md
```

---

## Testing Strategy Summary

| Layer                     | Tool                                 | When                        |
| ------------------------- | ------------------------------------ | --------------------------- |
| Type definitions          | TypeScript compiler (`tsc --noEmit`) | Every commit (CI)           |
| Config & format detectors | Mocha + Chai (no VS Code)            | Every commit                |
| Tree-sitter parser        | Mocha + Chai (no VS Code)            | Every commit                |
| Format renderers          | Mocha + Chai, snapshot assertions    | Every commit                |
| Docstring parser          | Mocha + Chai                         | Every commit                |
| Update engine             | Mocha + Chai                         | Every commit                |
| Raises analyzer script    | `pytest` on `analyzer.py` directly   | Every commit                |
| AI prompts                | Mocha + Chai with mock LM            | Every commit                |
| VS Code integration       | `@vscode/test-cli` + fixture files   | Every commit (CI with xvfb) |
| Format conversion         | Mocha + Chai (round-trip tests)      | Every commit                |

Snapshot files for renderer tests are committed to the repository. Any change to snapshot output requires an explicit `npm run test:update-snapshots`, producing a diff for review.

---

## Milestones

| Milestone  | Contents                                   | Phase(s) |
| ---------- | ------------------------------------------ | -------- |
| **v0.1.0** | Scaffolding, manifest, CI pipeline         | 1        |
| **v0.2.0** | Config resolution, format detection        | 2        |
| **v0.3.0** | Tree-sitter parser, all edge cases passing | 3        |
| **v0.4.0** | All three format renderers                 | 4        |
| **v1.0.0** | All triggers, commands, code actions       | 5        |
| **v1.1.0** | Docstring parser, full update flow         | 6        |
| **v1.2.0** | Python subprocess, precise raises          | 7        |
| **v1.3.0** | AI assistance, format conversion           | 8        |
