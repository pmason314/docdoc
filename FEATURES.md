# Python Docstring Generator — Feature Specification

## Table of Contents

- [Docstring Formats](#docstring-formats)
- [Trigger Mechanisms](#trigger-mechanisms)
- [Signature Parsing](#signature-parsing)
- [Docstring Generation](#docstring-generation)
- [Docstring Updating](#docstring-updating)
- [AI Assistance](#ai-assistance)
- [Commands](#commands)
- [Settings](#settings)

---

## Docstring Formats

The extension supports three standard Python docstring formats. The active format is determined in priority order:

1. **Explicit setting** — `docstringGenerator.format` in VS Code settings, if set.
2. **pyproject.toml auto-detection** — the extension reads the nearest `pyproject.toml` and checks, in order:
   - `[tool.ruff.lint.pydocstyle] convention` (`"google"`, `"numpy"`, `"pep257"`)
   - `[tool.pydocstyle] convention`
   - `[tool.pylint.format] docstring-convention`
3. **Default** — Google style.

Auto-detection runs once on workspace open and re-runs when `pyproject.toml` changes. The detected format is shown in the notification area and can always be overridden by the explicit setting.

### Google Style
```python
def f(x: int, y: str = "hi") -> bool:
    """Summary line.

    Args:
        x (int): Description.
        y (str): Description. Defaults to "hi".

    Returns:
        bool: Description.

    Raises:
        ValueError: Description.
    """
```

### NumPy Style
```python
def f(x: int, y: str = "hi") -> bool:
    """Summary line.

    Parameters
    ----------
    x : int
        Description.
    y : str, optional
        Description, by default "hi".

    Returns
    -------
    bool
        Description.

    Raises
    ------
    ValueError
        Description.
    """
```

### Sphinx / reStructuredText Style
```python
def f(x: int, y: str = "hi") -> bool:
    """Summary line.

    :param x: Description.
    :type x: int
    :param y: Description.
    :type y: str
    :returns: Description.
    :rtype: bool
    :raises ValueError: Description.
    """
```

---

## Trigger Mechanisms

### Triple-Quote Trigger
Typing `"""` or `'''` on the line immediately following a `def` or `class` statement (or at the top of a module for a module-level docstring) automatically expands the docstring template. The trigger fires after the closing quote of the opening delimiter is typed.

- Works on the same line as the opening `"""` or on the next line.
- Replaces the typed delimiter with the full generated docstring.
- Respects the configured quote style (`"""` vs `'''`).
- **Indentation is inferred from the trigger position**, not hardcoded. For module-level docstrings (no enclosing `def` or `class`), the docstring is generated at column 0 with no leading whitespace. For function- and class-level docstrings, indentation is the enclosing scope's indent level plus one level. This correctly handles file-level docstrings, which the original autoDocstring extension handled incorrectly by applying function-level indentation.
- Can be disabled independently of other triggers (`docstringGenerator.trigger.tripleQuote`).

**Performance:** The trigger is registered as a `TextDocumentChangeListener`, which fires on every edit. To avoid unnecessary parsing overhead, the listener applies a fast-path check first: it only proceeds when the changed text is exactly `"""` or `'''` (3 characters). All other edits are rejected immediately with no tree-sitter invocation.

### Command Palette / Keybinding
A `Generate Docstring` command places the cursor anywhere inside or on the `def`/`class` line, or at the top of the file for module-level docstrings. The docstring is inserted immediately below the signature, pushing any existing body content down.

- No default keybinding — users can assign one via `Preferences: Open Keyboard Shortcuts`.
- If a docstring already exists, defers to the Update flow (see [Docstring Updating](#docstring-updating)).

### Code Action (Lightbulb)
A code action is registered for any line containing a `def` or `class` with no existing docstring, and for the first lines of a module with no module-level docstring. The lightbulb appears when the cursor is on or adjacent to the signature.

- Action title: `Generate docstring`.
- Appears as a Quick Fix, not a Refactor, so it surfaces prominently.
- Suppressed if a docstring already exists (an Update action appears instead).

### On-Save Generation (opt-in)
When enabled, the extension scans the saved file for functions and classes with no docstring and generates stubs for all of them.

- Disabled by default (`docstringGenerator.onSave.enable: false`).
- Targets all functions and classes, including private ones (those prefixed with `_`).

---

## Signature Parsing

Parsing uses a two-layer strategy: **tree-sitter** (via `web-tree-sitter` with `tree-sitter-python`) for resilient signature extraction, and an optional **Python subprocess** (using the workspace interpreter) for deeper semantic analysis where tree-sitter is insufficient.

### What is Always Extracted (tree-sitter)

**Parameters**
- Name
- Type annotation (raw text, including complex generics like `dict[str, list[int]]`)
- Default value (raw text)
- Kind: positional-only (`/`), regular, keyword-only (`*`), `*args`, `**kwargs`
- Whether the parameter is optional (has a default)

**Return type**
- Raw annotation text from the `->` clause
- `None` return is detected and the Returns section is suppressed or marked accordingly

**Decorators**
- Full decorator text is captured
- Known decorators affect output: `@classmethod` suppresses `cls`, `@staticmethod` suppresses both `self`/`cls`, `@property` suppresses parameters and return annotation duplication

**Async / generator markers**
- `async def` is noted in generated docs when `docstringGenerator.includeAsync` is enabled
- Generator functions (`yield` in body) can trigger a `Yields` section instead of `Returns`

**Class-level specifics**
- `__init__` parameters are hoisted to the class docstring when `docstringGenerator.mergeInitParams` is enabled
- Class-level `ClassVar` and `dataclass` field annotations are extracted for the Attributes section

**Multi-line signatures**
- Signatures split across multiple lines (common after Black/Ruff formatting) are fully supported
- Parenthesis depth tracking handles nested generics in annotations: `Callable[[int, str], bool]`

**PEP 695 type parameters (Python 3.12+)**
- Generic function syntax `def f[T, S: str](x: T) -> S` is parsed for the type parameter list via the `type_parameter` node in tree-sitter-python
- `TypeVarTuple` (`*Ts`) and `ParamSpec` (`**P`) variance is noted
- Bounds (`S: str`) are captured via `constrained_type` nodes

**`@overload` handling**
- Functions decorated with `@typing.overload` are stub signatures only. The extension generates docstrings for the implementation signature (the un-decorated overload), not for the `@overload` stubs.

### What Requires the Python Subprocess (opt-in)

**Raises detection**
- The workspace Python interpreter is invoked via a one-shot subprocess with a small AST script that walks the function body
- `raise` statements are classified: direct raises, re-raises (`raise` with no argument inside `except`), and transformed raises (`raise X from e`)
- Raises that are caught and not re-raised within the same function are excluded
- `except*` blocks (Python 3.11+) are handled correctly
- Falls back gracefully to tree-sitter token scanning (less accurate) when no interpreter is available

**Forward reference resolution**
- Stringified annotations (`"MyClass"`, `"list[int]"`) are unwrapped
- `from __future__ import annotations` (PEP 563) mode is detected; all annotations are treated as strings and unwrapped

### Handled Edge Cases

- Parameters with no annotation produce a blank type placeholder (configurable)
- `self` and `cls` are always suppressed from the parameters section
- Positional-only marker `/` and keyword-only marker `*` are never emitted as parameters
- Duplicate parameter names (invalid Python) produce a warning and the duplicate is skipped
- Non-default after default (invalid Python) still generates for the params that are valid; a warning is shown
- Implicit string concatenation in annotations is joined before display
- When tree-sitter produces ERROR nodes inside a function signature (malformed Python), unparseable parameters are skipped and a warning diagnostic is emitted; generation proceeds with the parameters that were successfully extracted

---

## Docstring Generation

### Output as VS Code Snippets
All generated docstrings are inserted as [VS Code snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets), not plain text. This means:

- The summary line becomes `$1` — the cursor lands there immediately.
- Each parameter description is a separate tab stop.
- The return description is a tab stop.
- `$0` (final cursor position) is placed at the end of the last description field, so the cursor remains near the content the user was just editing rather than jumping past the closing `"""`.
- Pressing `Tab` advances through each field; pressing `Escape` or typing outside the snippet exits.

### Summary Line
- A single-line placeholder is always emitted as the first line.
- When AI assistance is enabled, this is pre-filled with a generated summary (see [AI Assistance](#ai-assistance)).
- When disabled, the placeholder text is configurable (`docstringGenerator.placeholders.summary`, default: `"_summary_"`).

### Parameters Section
- Emitted in declaration order.
- When `docstringGenerator.includeTypesFromAnnotations` is `true`, type information from the signature annotation is included in the docstring. When `false`, type fields are omitted entirely — useful when the codebase treats type annotations as the single source of truth and considers repeating them in the docstring redundant.
- Default values are noted in the description placeholder text when `docstringGenerator.includeDefaults` is enabled (e.g., `Defaults to 5.`).
- `*args` and `**kwargs` are included with their unpacked type when annotated (e.g., `*args: int` → type shown as `int`).

### Returns Section
- Suppressed entirely when the return annotation is `None` or `-> None` (controlled by `docstringGenerator.returns.skipNone`, default: `true`).
- Suppressed when the function is `__init__`.
- Suppressed when no return annotation is present and `docstringGenerator.returns.requireAnnotation` is `true` (the default). Set to `false` to emit a blank-typed Returns entry for unannotated functions.
- **Interaction:** `skipNone` takes priority over `requireAnnotation`. A function annotated `-> None` is always suppressed when `skipNone` is `true`, regardless of `requireAnnotation`.
- Generator functions emit `Yields` instead of `Returns` when `docstringGenerator.detectGenerators` is enabled.

### Raises Section
- Always emitted when unhandled `raise` statements are detected; there is no setting to disable this.
- Requires the subprocess analyzer for full accuracy; falls back to tree-sitter token scanning when no interpreter is available (`docstringGenerator.raises.useSimpleScan`).

### Attributes Section (Classes)
- Emitted for `dataclass` fields and class-level annotated assignments.
- `ClassVar` fields are included; `InitVar` fields are excluded.
- The section is omitted for classes with no class-level annotations.

### Indentation
- Indentation is inferred from the `def`/`class` line plus one level, or column 0 for module-level docstrings.
- Respects the workspace's `editor.tabSize` and `editor.insertSpaces` settings.
- Never uses a hardcoded indent width.

### Quote Style
- `"""` (double) by default.
- `'''` (single) available via `docstringGenerator.quoteStyle`.

### Ruff Style Compatibility
For new docstrings, the extension reads `pyproject.toml` or `ruff.toml` to match two stylistic rules automatically, with no user-facing settings:

- **Summary line position (D212 vs D213)** — if D213 is in `extend-select` or D212 is in `extend-ignore`, the summary is placed on the line after the opening `"""`. Otherwise the summary starts on the same line (D212, the Google convention default). If no Ruff config is found, same-line is used.
- **One-liner collapse (D200)** — if D200 is active (it is under all conventions by default), summary-only docstrings are collapsed to a single line. If D200 is in `extend-ignore`, a multi-line block is emitted.

Reformatting the style of *existing* docstrings to match these rules is the job of a formatter (Ruff, Black) and is explicitly out of scope for this extension.

---

## Docstring Updating

When invoked on a function that already has a docstring, the extension enters Update mode rather than overwriting.

### What is Preserved
- The existing summary line (never overwritten).
- Hand-written parameter descriptions.
- Hand-written return descriptions.
- Any custom sections not recognized by the parser (e.g., `Notes`, `Examples`, `References`, `Todo`).
- Raises entries that were manually added.

### What is Added
- Parameters present in the signature but missing from the docstring.
- Return section, if now present in the signature but absent from the docstring.
- Raises entries newly detected by the analyzer.

### What is Removed (opt-in)
- Parameters present in the docstring but no longer in the signature.
- Controlled by `docstringGenerator.update.removeStaleParams` (default: `true`). When `false`, stale entries are left in place.

### Type Annotation Sync
When `docstringGenerator.includeTypesFromAnnotations` is `false`, any existing type fields in the docstring's parameter and return entries are stripped on update. This keeps the docstring in sync as the policy changes or as annotations are added to previously unannotated functions. When the setting is `true`, type fields are added or updated to match the current signature annotation.

### What is Never Changed Automatically
- The format of an existing docstring (no format conversion on update).
- Quote style of an existing docstring.
- Ordering of existing sections.

### Conflict Resolution
- If the existing docstring format is detected but differs from the configured format, the update uses the existing docstring's format.
- Format detection is best-effort; an unrecognized format falls back to append-only mode (no removals or reordering).

---

## AI Assistance

AI assistance is opt-in and uses the [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model) (`vscode.lm`).

### Compatible LM Providers

The extension calls `vscode.lm.selectChatModels()`, which surfaces any model registered with VS Code via the Language Model Chat Provider API (introduced in VS Code 1.104). Compatible providers include:

- **GitHub Copilot** (Free, Pro, Pro+, Business, Enterprise) — the primary supported provider. Copilot's model roster includes Claude models (e.g., Claude Haiku 4.5) as well as GPT-4o and others. No extra setup needed if Copilot is already installed.
- **BYOK providers** — AI Toolkit (Azure AI Foundry), Hugging Face, Cerebras, and any OpenAI-compatible endpoint configured via `github.copilot.chat.customOAIModels`. This includes pointing at the Anthropic API directly through its OpenAI-compatible route with your own API key.
- **Any other extension** that implements `lm.registerLanguageModelChatProvider` will also work automatically.

**Claude Code** is an agentic coding tool, not a language model provider; it does not expose models through `vscode.lm` and is not compatible with this integration. **OpenCode** is a CLI tool with no VS Code LM API surface. If you want to use Claude models specifically, the recommended path is GitHub Copilot (which includes Claude in its model picker) or the Anthropic BYOK configuration.

### Summary Generation
When enabled, the extension sends the function signature (and optionally the function body) to the active LM and requests a one-sentence summary. The result pre-fills the summary tab stop in the snippet.

- Controlled by `docstringGenerator.ai.generateSummary` (default: `false`).
- The user can still edit or replace the AI-generated summary before accepting the snippet.

### Parameter Description Generation
When enabled, each parameter description tab stop is pre-filled with an AI-generated description based on the parameter name, type, and function context.

- Controlled by `docstringGenerator.ai.generateParamDescriptions` (default: `false`).
- Only fires when a parameter has no existing description (i.e., on initial generation or for new params during update).

### Return Description Generation
- Controlled by `docstringGenerator.ai.generateReturnDescription` (default: `false`).
- Pre-fills the return description tab stop.

### Context Sent to the LM
By default, only the function signature is sent. Optionally, the full function body can be included for richer context, at the cost of higher token usage.

- `docstringGenerator.ai.includeBodyContext` (default: `false`).
- The body is never sent if it exceeds `docstringGenerator.ai.maxBodyTokens` (default: `500` tokens).
- No file-level or project-level context is ever sent by default.

### LM Selection
- The extension uses `vscode.lm.selectChatModels()` to pick the best available model automatically.
- A specific model family can be pinned via `docstringGenerator.ai.modelFamily` (e.g., `"claude-haiku"`, `"gpt-4o"`).
- Falls back to non-AI generation silently if no model is available.

### Privacy & Telemetry
- The extension collects no telemetry, usage metrics, or content logs. It does not participate in VS Code's telemetry infrastructure.
- Content sent to the LM is subject to the LM provider's privacy policy (e.g., GitHub Copilot's).
- AI features are always opt-in and clearly labeled in settings.

---

## Commands

| Command ID                             | Title                                    | Keybinding             | Description                                                                                       |
| -------------------------------------- | ---------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| `docstringGenerator.generate`          | `Python: Generate Docstring`             | None (user-assignable) | Generate or update the docstring for the function/class at the cursor.                            |
| `docstringGenerator.generateFile`      | `Python: Generate Docstrings for File`   | —                      | Generate docstrings for all undocumented functions and classes in the active file.                |
| `docstringGenerator.update`            | `Python: Update Docstring`               | —                      | Re-analyze and update the docstring at the cursor, adding missing params and removing stale ones. |
| `docstringGenerator.updateFile`        | `Python: Update All Docstrings in File`  | —                      | Re-analyze and update all existing docstrings in the active file.                                 |
| `docstringGenerator.convertFormat`     | `Python: Convert Docstring Format`       | —                      | Convert the docstring at the cursor from its current format to the configured format.             |
| `docstringGenerator.convertFileFormat` | `Python: Convert All Docstrings in File` | —                      | Convert all docstrings in the active file to the configured format.                               |

All commands are only active when the active editor contains a Python file (`when: editorLangId == python`).

### Concurrency
All generation and update operations set an internal busy flag. If a command is invoked while another operation is already in progress (e.g., AI-assisted generation, on-save generation), the new invocation returns immediately with no effect. This prevents reentrancy issues and duplicate edits.

### Undo Behavior
- Single-target commands (`generate`, `update`, `convertFormat`) insert via `editor.insertSnippet` or a single `WorkspaceEdit`, producing one atomic undo step.
- File-wide commands (`generateFile`, `updateFile`, `convertFileFormat`) apply all edits in a single `WorkspaceEdit` so the entire operation can be undone with a single `Ctrl+Z`.

---

## Settings

### Core

| Setting                         | Type           | Default    | Description                                                                                                                              |
| ------------------------------- | -------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `docstringGenerator.format`     | `enum` \| `""` | `""`       | Docstring format. Options: `google`, `numpy`, `sphinx`. If empty, format is auto-detected from `pyproject.toml`; falls back to `google`. |
| `docstringGenerator.quoteStyle` | `enum`         | `"double"` | Quote style for generated docstrings. Options: `double` (`"""`), `single` (`'''`).                                                       |

### Triggers

| Setting                                  | Type      | Default | Description                                                                  |
| ---------------------------------------- | --------- | ------- | ---------------------------------------------------------------------------- |
| `docstringGenerator.trigger.tripleQuote` | `boolean` | `true`  | Enable the triple-quote auto-expand trigger.                                 |
| `docstringGenerator.trigger.codeAction`  | `boolean` | `true`  | Show the lightbulb code action on undocumented functions.                    |
| `docstringGenerator.onSave.enable`       | `boolean` | `false` | Generate docstrings for all undocumented functions and classes on file save. |

### Parameters

| Setting                                          | Type      | Default | Description                                                                                                                                                                              |
| ------------------------------------------------ | --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docstringGenerator.includeTypesFromAnnotations` | `boolean` | `true`  | Include type info in the docstring when a type annotation is present in the signature. When `false`, type fields are omitted on generation and stripped from existing entries on update. |
| `docstringGenerator.includeDefaults`             | `boolean` | `true`  | Append `Defaults to X.` in the parameter description when a default value is present.                                                                                                    |
| `docstringGenerator.includeExtendedSummary`      | `boolean` | `false` | Include an extended summary placeholder section after the one-line summary.                                                                                                              |

### Returns

| Setting                                        | Type      | Default | Description                                                                                                                                                               |
| ---------------------------------------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docstringGenerator.returns.skipNone`          | `boolean` | `true`  | Suppress the Returns section when the return annotation is `None` or absent.                                                                                              |
| `docstringGenerator.returns.requireAnnotation` | `boolean` | `true`  | Only emit a Returns section when a return annotation is present. When `skipNone` is also `true`, `skipNone` takes priority (a `-> None` annotation is always suppressed). |
| `docstringGenerator.detectGenerators`          | `boolean` | `true`  | Emit `Yields` instead of `Returns` for generator functions.                                                                                                               |

### Raises

| Setting                                   | Type      | Default | Description                                                                                                 |
| ----------------------------------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `docstringGenerator.raises.useSubprocess` | `boolean` | `true`  | Use the workspace Python interpreter for precise raises analysis. Falls back to simple scan if unavailable. |
| `docstringGenerator.raises.useSimpleScan` | `boolean` | `true`  | Fall back to tree-sitter token scanning for raises when no interpreter is available.                        |

### Classes

| Setting                                     | Type      | Default | Description                                                                                           |
| ------------------------------------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `docstringGenerator.mergeInitParams`        | `boolean` | `false` | Hoist `__init__` parameters into the class-level docstring instead of documenting them on `__init__`. |
| `docstringGenerator.includeClassAttributes` | `boolean` | `true`  | Include an Attributes section for class-level annotated assignments and dataclass fields.             |

### Update Behavior

| Setting                                       | Type      | Default | Description                                                                                                                                      |
| --------------------------------------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docstringGenerator.update.removeStaleParams` | `boolean` | `true`  | Remove parameter entries from the docstring when the parameter no longer exists in the signature. When `false`, stale entries are left in place. |

### Placeholders

| Setting                                       | Type     | Default       | Description                                                                                  |
| --------------------------------------------- | -------- | ------------- | -------------------------------------------------------------------------------------------- |
| `docstringGenerator.placeholders.summary`     | `string` | `"_summary_"` | Placeholder text for the summary line when AI generation is disabled.                        |
| `docstringGenerator.placeholders.description` | `string` | `""`          | Placeholder text for parameter and return descriptions. Empty string leaves the field blank. |

### Python Interpreter

| Setting                         | Type     | Default | Description                                                                                                                                                   |
| ------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docstringGenerator.pythonPath` | `string` | `""`    | Explicit path to the Python interpreter for AST analysis. If empty, the extension uses the interpreter selected by the Python extension (`ms-python.python`). |

### AI Assistance

| Setting                                           | Type      | Default | Description                                                                                                                           |
| ------------------------------------------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `docstringGenerator.ai.generateSummary`           | `boolean` | `false` | Use the VS Code LM API to generate the summary line.                                                                                  |
| `docstringGenerator.ai.generateParamDescriptions` | `boolean` | `false` | Use the VS Code LM API to generate parameter descriptions.                                                                            |
| `docstringGenerator.ai.generateReturnDescription` | `boolean` | `false` | Use the VS Code LM API to generate the return description.                                                                            |
| `docstringGenerator.ai.includeBodyContext`        | `boolean` | `false` | Send the function body to the LM for richer context.                                                                                  |
| `docstringGenerator.ai.maxBodyTokens`             | `number`  | `500`   | Maximum number of tokens from the function body to include in the LM prompt.                                                          |
| `docstringGenerator.ai.modelFamily`               | `string`  | `""`    | Pin to a specific LM model family (e.g., `"claude-haiku"`, `"gpt-4o"`). If empty, the best available model is selected automatically. |
