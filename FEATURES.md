# Docdoc Capabilities

## Surface Area
- VS Code extension for Python files only (activates on Python language).
- Inline completion provider, quick-fix code action provider, command palette commands, and on-save handler.

## User Commands
- Python: Generate Docstring (`docdoc.generate`): generate for function/class at or above cursor.
- Python: Generate All Docstrings for File (`docdoc.generateFile`): generate for all undocumented defs/classes in file.
- Python: Update Docstring (`docdoc.update`): merge current signature into existing docstring at cursor.
- Python: Update All Docstrings in File (`docdoc.updateFile`): merge all documented defs in file.
- Python: Convert Docstring Format (`docdoc.convertFormat`): parse docstring near cursor and re-render normalized Google style.
- Python: Convert All Docstrings in File (`docdoc.convertFileFormat`): normalize all docstrings in file to Google style.

## Triggering And Discovery
- Inline trigger on typing exactly `"""` or `'''` on a line prefix (whitespace + quote token).
- Inline generation also supports module-level docstring suggestion when at top-level (only comments/blank lines above).
- Quick-fix action "Generate docstring" appears on undocumented `def`/`class` lines.

## Generation Semantics
- Supports single-line and multi-line signatures (including async defs).
- Finds nearest signature by upward scan (handles decorators and nearby blank lines).
- Parses parameters with nested bracket awareness; supports annotations, defaults, kw-only separator, `*args`, `**kwargs`.
- Excludes `self` and `cls` from generated Args/params.
- Generates function and class docstrings; class docstrings are summary-only unless updated manually later.
- Uses `Yields` instead of `Returns` for detected generator functions.
- Auto-detects raised exception names from function body and emits `Raises` entries.
- Skips raises in nested defs/classes, bare `raise`, and lowercase variable raises.
- Deduplicates detected exceptions in order of first appearance.

## File-Wide Generation
- Inserts docstrings for all undocumented defs/classes in document order.
- Optional module docstring insertion at file top when missing.
- Avoids inserting when a docstring already exists on first non-empty body line.

## Update Semantics
- Parses existing Google docstring, merges with current signature, and replaces in place.
- Reorders params to match signature order.
- Preserves existing descriptions for unchanged params.
- Adds placeholder descriptions for new params.
- Removes stale params not present in signature.
- Preserves summary, extended summary, Raises, and unknown/custom sections.
- Updates Returns/Yields type hint from current return annotation while preserving description text.

## Formatting Support
- Generation output formats: Google, NumPy, Sphinx.
- Both snippet-style (inline completion) and plain-text builders are implemented for all three formats.
- Parsers implemented for Google, NumPy, and Sphinx docstrings.
- Current command-level convert/update flows operate on Google parse/render path.

## Configuration
- `docdoc.format`: `auto`, `google`, `numpy`, `sphinx`.
- `docdoc.quoteStyle`: `double` or `single` quote docstrings.
- `docdoc.includeTypesFromAnnotations`: include type hints in params.
- `docdoc.includeDefaults`: append "Defaults to X." when defaults exist.
- `docdoc.returns.mode`: `always` or `non-none` for Returns/Yields emission.
- `docdoc.generateModuleDocstring`: include module-level docstring in file-wide generation.
- `docdoc.onSave.enable`: auto-run generation on save.
- `docdoc.placeholders.summary`: summary placeholder text.
- `docdoc.placeholders.description`: param/return placeholder text.

## On-Save Behavior
- On save of Python files, if enabled, runs file-wide generation and updates for undocumented defs/classes.
- Does not run convert on save.

## UX Behavior
- Shows informational messages for no-op cases (no symbol found, docstring exists, nothing to update/convert, parse failure).

## Notable Current Constraints
- `format: auto` currently falls back to Google in builder dispatch.
- Convert commands normalize to the currently configured docstring style.
- Update path expects parseable docstrings in the configured style.
