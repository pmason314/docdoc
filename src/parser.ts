import type { ParsedDocstring, ParsedDocstringParam } from "./docstringParser";
import { parseGoogleDocstring } from "./docstringParser";

// Matches: def foo(...) -> bool:   also handles async def
export const DEF_RE = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(.+?)\s*)?:\s*$/;
// Matches: class Foo:  or  class Foo(Base):
export const CLASS_RE = /^(\s*)class\s+(\w+)/;
// Matches a decorator line
export const DECORATOR_RE = /^\s*@/;

// ---------------------------------------------------------------------------
// Config types (pure, no vscode dependency)
// ---------------------------------------------------------------------------

export type ReturnMode = "non-none" | "always";
export type DocstringFormat = "auto" | "google" | "numpy" | "sphinx";

export interface DocstringOptions {
  /** `'"""'` or `"'''"` derived from quoteStyle config. */
  quoteChar: string;
  /** Docstring format. `"auto"` detects from pyproject.toml; falls back to Google. */
  format: DocstringFormat;
  /** Include `(type)` in Args entries when annotation is present. */
  includeTypes: boolean;
  /** Append `Defaults to X.` in param descriptions when a default is present. */
  includeDefaults: boolean;
  /** When to emit a Returns / Yields section. */
  returnsMode: ReturnMode;
  /** Placeholder for the one-line summary. */
  summaryPlaceholder: string;
  /** Placeholder for parameter / return descriptions. */
  descPlaceholder: string;
  /** Insert a module-level docstring if the file doesn't already have one. */
  generateModuleDocstring: boolean;
}

export const DEFAULT_OPTIONS: DocstringOptions = {
  quoteChar: '"""',
  format: "auto",
  includeTypes: true,
  includeDefaults: true,
  returnsMode: "always",
  summaryPlaceholder: "_summary_",
  descPlaceholder: "_description_",
  generateModuleDocstring: false,
};

export interface Param {
  name: string;
  annotation: string | null;
  hasDefault: boolean;
  /** Raw default-value text (e.g. `"2"`, `"'hello'"`, `"None"`). Only present when `hasDefault` is true. */
  defaultValue?: string;
}

export interface ParsedSignature {
  kind: "def" | "class";
  name: string;
  params: Param[];
  returnAnnotation: string | null;
}

/**
 * Split a raw parameter list string into individual parameter tokens,
 * respecting nested brackets so "a: Dict[str, int] = {}" is one token.
 */
export function splitParams(raw: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    if (ch === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = "";
    } else {
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") depth--;
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) result.push(trimmed);
  return result;
}

/**
 * Parse one parameter token like "a", "a: int", "b: str = 'x'", "*args", "**kwargs".
 * Returns null for a bare "*" separator. Preserves "*"/"**" prefix in the returned name.
 */
export function parseParam(token: string): Param | null {
  // Extract leading * or ** (preserved in name so *args / **kwargs display correctly)
  const starsMatch = token.match(/^(\*{1,2})/);
  const stars = starsMatch ? starsMatch[1] : "";
  const withoutLeadingStars = token.slice(stars.length);

  if (!withoutLeadingStars.trim()) return null; // bare * separator

  // Find the first `=` at bracket depth 0 — separates param from default value.
  let eqIdx = -1;
  {
    let d = 0;
    for (let i = 0; i < withoutLeadingStars.length; i++) {
      const c = withoutLeadingStars[i];
      if (c === "(" || c === "[" || c === "{") d++;
      else if (c === ")" || c === "]" || c === "}") d--;
      else if (c === "=" && d === 0) {
        eqIdx = i;
        break;
      }
    }
  }
  const hasDefault = eqIdx !== -1;
  const defaultValue = hasDefault ? withoutLeadingStars.slice(eqIdx + 1).trim() : undefined;
  const beforeEq = hasDefault
    ? withoutLeadingStars.slice(0, eqIdx).trim()
    : withoutLeadingStars.trim();

  const colonIdx = beforeEq.indexOf(":");
  if (colonIdx !== -1) {
    const p: Param = {
      name: stars + beforeEq.slice(0, colonIdx).trim(),
      annotation: beforeEq.slice(colonIdx + 1).trim(),
      hasDefault,
    };
    if (defaultValue !== undefined) p.defaultValue = defaultValue;
    return p;
  }
  const p: Param = { name: stars + beforeEq.trim(), annotation: null, hasDefault };
  if (defaultValue !== undefined) p.defaultValue = defaultValue;
  return p;
}

/** Build a ParsedSignature from a single-line DEF_RE match. */
function buildSigFromMatch(match: RegExpExecArray): ParsedSignature {
  const rawParams = match[3] ?? "";
  const returnStr = match[4] ?? null;
  const params: Param[] = [];
  for (const token of splitParams(rawParams)) {
    const p = parseParam(token);
    if (!p) continue;
    if (p.name === "self" || p.name === "cls") continue;
    params.push(p);
  }
  return { kind: "def", name: match[2], params, returnAnnotation: returnStr };
}

/**
 * Scan upward from closingLine collecting lines until paren depth balances
 * on a line containing `def`. Returns the assembled signature or null.
 */
function assembleMultiLineSig(
  lines: string[],
  closingLine: number,
  limit: number,
): { sig: ParsedSignature; defLine: number } | null {
  let depth = 0;
  const parts: string[] = [];
  for (let i = closingLine; i >= limit; i--) {
    const text = lines[i];
    parts.unshift(text.trim());
    for (const ch of text) {
      if (ch === ")" || ch === "]" || ch === "}") depth++;
      else if (ch === "(" || ch === "[" || ch === "{") depth--;
    }
    if (depth <= 0 && /(?:async\s+)?def\s/.test(text)) {
      const joined = parts.join(" ");
      const parenStartIdx = joined.search(/(?:async\s+)?def\s+\w+\s*\(/);
      if (parenStartIdx === -1) return null;
      const parenStart = joined.indexOf("(", parenStartIdx);
      let d = 0;
      let closeIdx = -1;
      for (let j = parenStart; j < joined.length; j++) {
        if (joined[j] === "(") d++;
        else if (joined[j] === ")") {
          d--;
          if (d === 0) {
            closeIdx = j;
            break;
          }
        }
      }
      if (closeIdx === -1) return null;
      const rawParams = joined.slice(parenStart + 1, closeIdx);
      const afterClose = joined.slice(closeIdx + 1).trim();
      const returnMatch = /^->\s*(.+?)\s*:/.exec(afterClose);
      const returnAnnotation = returnMatch ? returnMatch[1].trim() : null;
      const nameMatch = /(?:async\s+)?def\s+(\w+)/.exec(joined);
      if (!nameMatch) return null;
      const params: Param[] = [];
      for (const token of splitParams(rawParams)) {
        const p = parseParam(token);
        if (!p) continue;
        if (p.name === "self" || p.name === "cls") continue;
        params.push(p);
      }
      return {
        sig: { kind: "def", name: nameMatch[1], params, returnAnnotation },
        defLine: i,
      };
    }
    if (depth < 0) return null; // more opens than closes: malformed
  }
  return null;
}

/**
 * Scan upward from startLine (inclusive) to find the nearest def/class signature.
 * Skips blank lines and decorators. Handles multi-line signatures.
 * Returns the signature and the line index of the def/class keyword.
 */
export function findSignatureFromLines(
  lines: string[],
  startLine: number,
): { sig: ParsedSignature; defLine: number } | null {
  const limit = Math.max(0, startLine - 30);
  for (let i = startLine; i >= limit; i--) {
    const text = lines[i];
    const trimmed = text.trim();

    const defMatch = DEF_RE.exec(text);
    if (defMatch) {
      return { sig: buildSigFromMatch(defMatch), defLine: i };
    }

    const classMatch = CLASS_RE.exec(text);
    if (classMatch) {
      return {
        sig: { kind: "class", name: classMatch[2], params: [], returnAnnotation: null },
        defLine: i,
      };
    }

    if (trimmed === "" || DECORATOR_RE.test(text)) continue;

    // Non-def, non-blank, non-decorator: only try multi-line assembly if the line
    // looks like the tail of a signature (ends with ':' and contains ')').
    if (trimmed.endsWith(":") && trimmed.includes(")")) {
      const assembled = assembleMultiLineSig(lines, i, limit);
      if (assembled) return assembled;
    }
    break;
  }
  return null;
}

/**
 * Returns true if every line up to and including startLine is blank or a
 * comment, meaning the triple quote is at module scope.
 */
export function isModuleLevelLines(lines: string[], startLine: number): boolean {
  for (let i = startLine; i >= 0; i--) {
    const text = lines[i].trim();
    if (text === "" || text.startsWith("#")) continue;
    return false;
  }
  return true;
}

/**
 * Returns true if the function body (starting at bodyStartLine) contains a
 * `yield` statement, indicating this is a generator function.
 */
export function isGeneratorFunction(
  lines: string[],
  defLine: number,
  bodyStartLine: number,
): boolean {
  const defText = lines[defLine] ?? "";
  const defIndent = (defText.match(/^(\s*)/) ?? ["", ""])[1].length;

  for (let i = bodyStartLine; i < lines.length && i < bodyStartLine + 200; i++) {
    const text = lines[i];
    const trimmed = text.trim();
    if (!trimmed) continue;
    const lineIndent = (text.match(/^(\s*)/) ?? ["", ""])[1].length;
    if (lineIndent <= defIndent) break;
    if (/\byield\b/.test(trimmed)) return true;
  }
  return false;
}

/** Returns true when the Returns/Yields section should be omitted for `sig`. */
function shouldSkipReturn(sig: ParsedSignature, mode: ReturnMode): boolean {
  if (sig.kind !== "def") return true;
  if (mode === "always") return false;
  // "non-none": emit only when a non-None annotation is present
  return sig.returnAnnotation === null || sig.returnAnnotation === "None";
}

/**
 * Build a Google-style docstring as a raw VS Code snippet template string.
 *
 * VS Code normalizes inline-completion snippet indentation by prepending the
 * trigger line's indentation to every new line. This function therefore uses
 * *relative* indentation (0-based for section headers, 4-space for param
 * entries). The `indent` parameter is accepted for API compatibility but is
 * not used inside the snippet body.
 *
 * Example snippet for def foo(a: int) -> bool  (indent/quoteChar supplied by caller):
 *
 *   ${1:_summary_}
 *
 *   Args:
 *       a (int): ${2:_description_}
 *
 *   Returns:
 *       bool: ${3:_description_}
 *   """
 */
export function buildGoogleDocstring(
  sig: ParsedSignature,
  _indent: string,
  quoteChar: string,
  opts: Partial<DocstringOptions> & { isGenerator?: boolean } = {},
): string {
  const {
    includeTypes = DEFAULT_OPTIONS.includeTypes,
    includeDefaults = DEFAULT_OPTIONS.includeDefaults,
    returnsMode = DEFAULT_OPTIONS.returnsMode,
    summaryPlaceholder = DEFAULT_OPTIONS.summaryPlaceholder,
    descPlaceholder = DEFAULT_OPTIONS.descPlaceholder,
    isGenerator = false,
  } = opts;
  // 0-based: VS Code adds the trigger line's indentation to every new line.
  const paramIndent = "    ";
  let n = 1;
  const summaryPeriod = summaryPlaceholder.includes(".") ? "" : ".";
  let out = `\${${n++}:${summaryPlaceholder}}${summaryPeriod}`;

  if (sig.kind === "def" && sig.params.length > 0) {
    out += `\n\nArgs:\n`;
    for (const p of sig.params) {
      const typeHint = includeTypes && p.annotation ? ` (${p.annotation})` : "";
      const defaultsNote =
        includeDefaults && p.defaultValue ? ` Defaults to ${p.defaultValue}.` : "";
      const descSuffix = defaultsNote && !descPlaceholder.includes(".") ? "." : "";
      out += `${paramIndent}${p.name}${typeHint}: \${${n++}:${descPlaceholder}}${descSuffix}${defaultsNote}\n`;
    }
  }

  if (!shouldSkipReturn(sig, returnsMode)) {
    const sectionLabel = isGenerator ? "Yields" : "Returns";
    // Double newline when Returns/Yields is the first section (no Args above it)
    const sectionPrefix = out.endsWith("\n") ? "\n" : "\n\n";
    out += `${sectionPrefix}${sectionLabel}:\n`;
    const typePrefix =
      sig.returnAnnotation && sig.returnAnnotation !== "None" ? `${sig.returnAnnotation}: ` : "";
    out += `${paramIndent}${typePrefix}\${${n++}:${descPlaceholder}}\n`;
  }

  // Strip trailing whitespace from blank lines (VS Code indent-normalization adds
  // the trigger-line indent to every new line, including empty separator lines).
  // One-liner: no newline → closing quotes on same line (no indent needed).
  // Multi-line: last char is \n → closing quotes on new line; VS Code adds base indent.
  out += quoteChar;
  return out.replace(/^[ \t]+$/gm, "");
}

/** A plain-text docstring (no snippet syntax) for use in WorkspaceEdit insertions. */
export function buildGoogleDocstringText(
  sig: ParsedSignature,
  indent: string,
  quoteChar: string,
  opts: Partial<DocstringOptions> & { isGenerator?: boolean } = {},
): string {
  const {
    includeTypes = DEFAULT_OPTIONS.includeTypes,
    includeDefaults = DEFAULT_OPTIONS.includeDefaults,
    returnsMode = DEFAULT_OPTIONS.returnsMode,
    summaryPlaceholder = DEFAULT_OPTIONS.summaryPlaceholder,
    descPlaceholder = DEFAULT_OPTIONS.descPlaceholder,
    isGenerator = false,
  } = opts;
  const paramIndent = indent + "    ";
  const summaryPeriod = summaryPlaceholder.includes(".") ? "" : ".";
  let out = `${indent}${quoteChar}${summaryPlaceholder}${summaryPeriod}`;

  if (sig.kind === "def" && sig.params.length > 0) {
    out += `\n\n${indent}Args:\n`;
    for (const p of sig.params) {
      const typeHint = includeTypes && p.annotation ? ` (${p.annotation})` : "";
      const defaultsNote =
        includeDefaults && p.defaultValue ? ` Defaults to ${p.defaultValue}.` : "";
      const descSuffix = defaultsNote && !descPlaceholder.includes(".") ? "." : "";
      out += `${paramIndent}${p.name}${typeHint}: ${descPlaceholder}${descSuffix}${defaultsNote}\n`;
    }
  }

  if (!shouldSkipReturn(sig, returnsMode)) {
    const sectionLabel = isGenerator ? "Yields" : "Returns";
    // Double newline when Returns/Yields is the first section (no Args above it)
    const sectionPrefix = out.endsWith("\n") ? "\n" : "\n\n";
    out += `${sectionPrefix}${indent}${sectionLabel}:\n`;
    const typePrefix =
      sig.returnAnnotation && sig.returnAnnotation !== "None" ? `${sig.returnAnnotation}: ` : "";
    out += `${paramIndent}${typePrefix}${descPlaceholder}\n`;
  }

  // One-liner if no sections were added; otherwise close on its own line
  out += out.endsWith("\n") ? `${indent}${quoteChar}` : quoteChar;
  return out;
}

/** A single docstring insertion: insert `text` as a new line after `afterLine`. */
export interface DocstringInsertion {
  /** 0-based line index after which the docstring is inserted. */
  afterLine: number;
  /** Full docstring text (no trailing newline). */
  text: string;
}

/**
 * Returns true if the line immediately after `defLine` is an existing docstring
 * (starts with `"""` or `'''` after stripping leading whitespace).
 */
export function hasDocstring(lines: string[], defLine: number): boolean {
  // The docstring appears on the first non-empty line of the body
  for (let i = defLine + 1; i < lines.length && i <= defLine + 5; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    return trimmed.startsWith('"""') || trimmed.startsWith("'''");
  }
  return false;
}

/**
 * Scan every def/class in `lines` that lacks a docstring and return the
 * insertions needed to add Google-style docstrings to all of them.
 * Results are in document order (ascending afterLine).
 */
export function generateFileInsertions(
  lines: string[],
  opts: Partial<DocstringOptions> = {},
): DocstringInsertion[] {
  const insertions: DocstringInsertion[] = [];
  const quoteChar = opts.quoteChar ?? DEFAULT_OPTIONS.quoteChar;
  const summaryPh = opts.summaryPlaceholder ?? DEFAULT_OPTIONS.summaryPlaceholder;

  if (opts.generateModuleDocstring) {
    const hasModuleDoc = (() => {
      for (const line of lines) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        return t.startsWith('"""') || t.startsWith("'''");
      }
      return false;
    })();
    if (!hasModuleDoc) {
      const summaryPeriod = summaryPh.includes(".") ? "" : ".";
      insertions.push({
        afterLine: -1,
        text: `${quoteChar}${summaryPh}${summaryPeriod}${quoteChar}`,
      });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];

    // Only fire on def/class lines (single-line sigs; multi-line handled below).
    // Commented-out lines (e.g. `# def foo():`) never match DEF_RE/CLASS_RE because
    // `#` is not whitespace, so they are skipped automatically.
    const isDefOrClass = DEF_RE.test(text) || CLASS_RE.test(text);
    if (!isDefOrClass) continue;

    // Find the end of the signature (last line before the body starts)
    // For single-line sigs this is just i; for multi-line it's the closing `:` line
    let sigEndLine = i;
    if (!text.trimEnd().endsWith(":")) {
      // Multi-line: scan forward for the closing `:` that ends the signature
      let depth = 0;
      for (const ch of text) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      let j = i + 1;
      while (j < lines.length && depth > 0) {
        for (const ch of lines[j]) {
          if (ch === "(") depth++;
          else if (ch === ")") depth--;
        }
        j++;
      }
      sigEndLine = j - 1;
    }

    if (hasDocstring(lines, sigEndLine)) continue;

    // Build the signature from a backward scan starting at sigEndLine
    const found = findSignatureFromLines(lines, sigEndLine);
    if (!found) continue;

    // Determine indentation of the body (one level deeper than the def)
    const defIndent = (text.match(/^(\s*)/) ?? ["", ""])[1];
    const bodyIndent = defIndent + "    ";

    const isGenerator = isGeneratorFunction(lines, found.defLine, sigEndLine + 1);
    const docText = buildDocstringText(found.sig, bodyIndent, quoteChar, {
      isGenerator,
      ...opts,
    });

    insertions.push({ afterLine: sigEndLine, text: docText });
  }

  return insertions;
}

/**
 * Apply a list of insertions to a lines array and return the new lines.
 * Insertions must be in ascending order of afterLine.
 */
export function applyInsertions(lines: string[], insertions: DocstringInsertion[]): string[] {
  const result = [...lines];
  let offset = 0;
  for (const ins of insertions) {
    const insertAt = ins.afterLine + 1 + offset;
    result.splice(insertAt, 0, ins.text);
    offset++;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Phase 3b: merge, render, update
// ---------------------------------------------------------------------------

export interface MergeOpts {
  /** Treat the function as a generator (Yields instead of Returns). Default: false. */
  isGenerator?: boolean;
  /** When to emit a Returns / Yields section. Default: `"always"`. */
  returnsMode?: ReturnMode;
  /** Placeholder for new parameter / return descriptions. Default: `"_description_"`. */
  descPlaceholder?: string;
  /** Include type annotations in Args entries. Default: `true`. */
  includeTypes?: boolean;
}

/**
 * Merge a (possibly updated) signature into an existing parsed docstring.
 *
 * - Params are ordered according to `sig` (sig is the authority).
 * - Existing descriptions are preserved when the param name matches.
 * - New params get `_description_` placeholder.
 * - Stale params (no longer in the signature) are always removed.
 * - Summary, extended summary, raises, and unknown sections are preserved as-is.
 * - Returns/Yields typehint is updated from `sig.returnAnnotation`; description is kept.
 */
export function mergeDocstring(
  sig: ParsedSignature,
  existing: ParsedDocstring,
  opts: MergeOpts = {},
): ParsedDocstring {
  const {
    isGenerator = false,
    returnsMode = DEFAULT_OPTIONS.returnsMode,
    descPlaceholder = DEFAULT_OPTIONS.descPlaceholder,
    includeTypes = DEFAULT_OPTIONS.includeTypes,
  } = opts;

  const existingByName = new Map(existing.params.map((p) => [p.name, p]));

  const newParams: ParsedDocstringParam[] = sig.params.map((p) => {
    const found = existingByName.get(p.name);
    return {
      name: p.name,
      typehint: includeTypes ? (p.annotation ?? null) : null,
      description: found?.description ?? descPlaceholder,
    };
  });

  const skipReturn = shouldSkipReturn(sig, returnsMode);

  let newReturns: ParsedDocstring["returns"] = null;
  let newYields: ParsedDocstring["yields"] = null;

  if (!skipReturn) {
    const existingDesc =
      (isGenerator ? existing.yields?.description : existing.returns?.description) ??
      existing.returns?.description ??
      existing.yields?.description ??
      descPlaceholder;

    if (isGenerator) {
      newYields = { typehint: sig.returnAnnotation, description: existingDesc };
    } else {
      newReturns = { typehint: sig.returnAnnotation, description: existingDesc };
    }
  }

  return {
    summary: existing.summary,
    extendedSummary: existing.extendedSummary,
    params: newParams,
    returns: newReturns,
    yields: newYields,
    raises: existing.raises,
    unknownSections: existing.unknownSections,
  };
}

/**
 * Render a `ParsedDocstring` back to a plain-text Google docstring string.
 * Multi-line descriptions are re-indented with one extra level of indentation
 * (continuation lines at `paramIndent + "    "`).
 * Produces a one-liner when there are no sections.
 */
export function renderGoogleDocstring(
  parsed: ParsedDocstring,
  indent: string,
  quoteChar: string,
): string {
  const paramIndent = indent + "    ";
  const contIndent = paramIndent + "    ";

  /** Render a description that may contain embedded newlines. */
  function renderDesc(firstPrefix: string, desc: string): string {
    const lines = desc.split("\n");
    let s = `${firstPrefix}${lines[0]}\n`;
    for (let i = 1; i < lines.length; i++) s += `${contIndent}${lines[i]}\n`;
    return s;
  }

  const hasContent =
    parsed.params.length > 0 ||
    parsed.returns !== null ||
    parsed.yields !== null ||
    parsed.raises.length > 0 ||
    parsed.unknownSections.length > 0 ||
    parsed.extendedSummary !== "";

  if (!hasContent) {
    return `${indent}${quoteChar}${parsed.summary}${quoteChar}`;
  }

  let out = `${indent}${quoteChar}${parsed.summary}\n`;

  if (parsed.extendedSummary) {
    out += `\n${parsed.extendedSummary}\n`;
  }

  if (parsed.params.length > 0) {
    out += `\n${indent}Args:\n`;
    for (const p of parsed.params) {
      const typeHint = p.typehint ? ` (${p.typehint})` : "";
      out += renderDesc(`${paramIndent}${p.name}${typeHint}: `, p.description);
    }
  }

  const returnsEntry = parsed.yields ?? parsed.returns;
  if (returnsEntry) {
    const label = parsed.yields !== null ? "Yields" : "Returns";
    out += `\n${indent}${label}:\n`;
    const typePrefix = returnsEntry.typehint ? `${returnsEntry.typehint}: ` : "";
    out += renderDesc(`${paramIndent}${typePrefix}`, returnsEntry.description);
  }

  if (parsed.raises.length > 0) {
    out += `\n${indent}Raises:\n`;
    for (const r of parsed.raises) {
      out += renderDesc(`${paramIndent}${r.exception}: `, r.description);
    }
  }

  for (const section of parsed.unknownSections) {
    out += `\n${indent}${section.header}:\n`;
    for (const l of section.lines) out += `${l}\n`;
  }

  out += `${indent}${quoteChar}`;
  return out;
}

/** Return value of {@link buildUpdateText}. */
export interface UpdateTextResult {
  /** Fully rendered replacement docstring text. */
  text: string;
  /** 0-based line index of the existing docstring's opening quotes. */
  startLine: number;
  /** 0-based line index of the existing docstring's closing quotes. */
  endLine: number;
}

/**
 * High-level helper for the `update` command.
 *
 * Given the source lines and the 0-based index of the `def`/`class` line,
 * finds the existing docstring, parses it, merges with the current signature,
 * and renders the result ready to splice in via `WorkspaceEdit.replace`.
 *
 * Returns `null` when there is no existing docstring to update.
 */
export function buildUpdateText(
  lines: string[],
  defLine: number,
  opts: MergeOpts = {},
): UpdateTextResult | null {
  const found = findSignatureFromLines(lines, defLine);
  if (!found) return null;

  // Locate sigEndLine (last line of the signature — the `:` line)
  let sigEndLine = defLine;
  if (!lines[defLine].trimEnd().endsWith(":")) {
    let depth = 0;
    for (const ch of lines[defLine]) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    let j = defLine + 1;
    while (j < lines.length && depth > 0) {
      for (const ch of lines[j]) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      j++;
    }
    sigEndLine = j - 1;
  }

  // Find the docstring opening line in the body (first non-blank line after sig)
  let docOpenLine = -1;
  for (let i = sigEndLine + 1; i < Math.min(lines.length, sigEndLine + 6); i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) docOpenLine = i;
    break;
  }
  if (docOpenLine === -1) return null;

  const parseResult = parseGoogleDocstring(lines, docOpenLine);
  if (!parseResult) return null;

  const merged = mergeDocstring(found.sig, parseResult.parsed, opts);
  const text = renderGoogleDocstring(merged, parseResult.indent, parseResult.quoteChar);

  return { text, startLine: parseResult.startLine, endLine: parseResult.endLine };
}

// ---------------------------------------------------------------------------
// Phase 6: NumPy and Sphinx format builders
// ---------------------------------------------------------------------------

/**
 * Build a NumPy-style docstring as a raw VS Code snippet template string.
 *
 * Example for def foo(a: int) -> bool:
 *
 *   ${1:_summary_}
 *
 *   Parameters
 *   ----------
 *   a : int
 *       ${2:_description_}
 *
 *   Returns
 *   -------
 *   bool
 *       ${3:_description_}
 *   """
 */
export function buildNumpyDocstring(
  sig: ParsedSignature,
  _indent: string,
  quoteChar: string,
  opts: Partial<DocstringOptions> & { isGenerator?: boolean } = {},
): string {
  const {
    includeTypes = DEFAULT_OPTIONS.includeTypes,
    includeDefaults = DEFAULT_OPTIONS.includeDefaults,
    returnsMode = DEFAULT_OPTIONS.returnsMode,
    summaryPlaceholder = DEFAULT_OPTIONS.summaryPlaceholder,
    descPlaceholder = DEFAULT_OPTIONS.descPlaceholder,
    isGenerator = false,
  } = opts;
  const paramIndent = "    ";
  let n = 1;
  const summaryPeriod = summaryPlaceholder.includes(".") ? "" : ".";
  let out = `\${${n++}:${summaryPlaceholder}}${summaryPeriod}`;

  if (sig.kind === "def" && sig.params.length > 0) {
    out += `\n\nParameters\n----------\n`;
    for (const p of sig.params) {
      const typeStr = includeTypes && p.annotation ? ` : ${p.annotation}` : "";
      const defaultsNote =
        includeDefaults && p.defaultValue ? ` Defaults to ${p.defaultValue}.` : "";
      const descSuffix = defaultsNote && !descPlaceholder.includes(".") ? "." : "";
      out += `${p.name}${typeStr}\n${paramIndent}\${${n++}:${descPlaceholder}}${descSuffix}${defaultsNote}\n`;
    }
  }

  if (!shouldSkipReturn(sig, returnsMode)) {
    const sectionLabel = isGenerator ? "Yields" : "Returns";
    const dashes = "-".repeat(sectionLabel.length);
    const sectionPrefix = out.endsWith("\n") ? "\n" : "\n\n";
    out += `${sectionPrefix}${sectionLabel}\n${dashes}\n`;
    const typeStr =
      sig.returnAnnotation && sig.returnAnnotation !== "None" ? `${sig.returnAnnotation}\n` : "";
    out += `${typeStr}${paramIndent}\${${n++}:${descPlaceholder}}\n`;
  }

  out += quoteChar;
  return out.replace(/^[ \t]+$/gm, "");
}

/** Plain-text NumPy docstring for WorkspaceEdit insertions. */
export function buildNumpyDocstringText(
  sig: ParsedSignature,
  indent: string,
  quoteChar: string,
  opts: Partial<DocstringOptions> & { isGenerator?: boolean } = {},
): string {
  const {
    includeTypes = DEFAULT_OPTIONS.includeTypes,
    includeDefaults = DEFAULT_OPTIONS.includeDefaults,
    returnsMode = DEFAULT_OPTIONS.returnsMode,
    summaryPlaceholder = DEFAULT_OPTIONS.summaryPlaceholder,
    descPlaceholder = DEFAULT_OPTIONS.descPlaceholder,
    isGenerator = false,
  } = opts;
  const paramIndent = indent + "    ";
  const summaryPeriod = summaryPlaceholder.includes(".") ? "" : ".";
  let out = `${indent}${quoteChar}${summaryPlaceholder}${summaryPeriod}`;

  if (sig.kind === "def" && sig.params.length > 0) {
    out += `\n\n${indent}Parameters\n${indent}----------\n`;
    for (const p of sig.params) {
      const typeStr = includeTypes && p.annotation ? ` : ${p.annotation}` : "";
      const defaultsNote =
        includeDefaults && p.defaultValue ? ` Defaults to ${p.defaultValue}.` : "";
      const descSuffix = defaultsNote && !descPlaceholder.includes(".") ? "." : "";
      out += `${indent}${p.name}${typeStr}\n${paramIndent}${descPlaceholder}${descSuffix}${defaultsNote}\n`;
    }
  }

  if (!shouldSkipReturn(sig, returnsMode)) {
    const sectionLabel = isGenerator ? "Yields" : "Returns";
    const dashes = "-".repeat(sectionLabel.length);
    const sectionPrefix = out.endsWith("\n") ? "\n" : "\n\n";
    out += `${sectionPrefix}${indent}${sectionLabel}\n${indent}${dashes}\n`;
    const typeStr =
      sig.returnAnnotation && sig.returnAnnotation !== "None"
        ? `${indent}${sig.returnAnnotation}\n`
        : "";
    out += `${typeStr}${paramIndent}${descPlaceholder}\n`;
  }

  out += out.endsWith("\n") ? `${indent}${quoteChar}` : quoteChar;
  return out;
}

/**
 * Build a Sphinx (reStructuredText) docstring as a raw VS Code snippet template string.
 *
 * Example for def foo(a: int) -> bool:
 *
 *   ${1:_summary_}
 *
 *   :param a: ${2:_description_}
 *   :type a: int
 *   :returns: ${3:_description_}
 *   :rtype: bool
 *   """
 */
export function buildSphinxDocstring(
  sig: ParsedSignature,
  _indent: string,
  quoteChar: string,
  opts: Partial<DocstringOptions> & { isGenerator?: boolean } = {},
): string {
  const {
    includeTypes = DEFAULT_OPTIONS.includeTypes,
    includeDefaults = DEFAULT_OPTIONS.includeDefaults,
    returnsMode = DEFAULT_OPTIONS.returnsMode,
    summaryPlaceholder = DEFAULT_OPTIONS.summaryPlaceholder,
    descPlaceholder = DEFAULT_OPTIONS.descPlaceholder,
    isGenerator = false,
  } = opts;
  let n = 1;
  const summaryPeriod = summaryPlaceholder.includes(".") ? "" : ".";
  let out = `\${${n++}:${summaryPlaceholder}}${summaryPeriod}`;

  if (sig.kind === "def" && sig.params.length > 0) {
    out += `\n\n`;
    for (const p of sig.params) {
      const defaultsNote =
        includeDefaults && p.defaultValue ? ` Defaults to ${p.defaultValue}.` : "";
      const descSuffix = defaultsNote && !descPlaceholder.includes(".") ? "." : "";
      out += `:param ${p.name}: \${${n++}:${descPlaceholder}}${descSuffix}${defaultsNote}\n`;
      if (includeTypes && p.annotation) {
        out += `:type ${p.name}: ${p.annotation}\n`;
      }
    }
  }

  if (!shouldSkipReturn(sig, returnsMode)) {
    const sectionPrefix = out.endsWith("\n") ? "" : "\n\n";
    out += `${sectionPrefix}:returns: \${${n++}:${descPlaceholder}}\n`;
    if (sig.returnAnnotation && sig.returnAnnotation !== "None") {
      out += `:rtype: ${sig.returnAnnotation}\n`;
    }
  }

  out += quoteChar;
  return out.replace(/^[ \t]+$/gm, "");
}

/** Plain-text Sphinx docstring for WorkspaceEdit insertions. */
export function buildSphinxDocstringText(
  sig: ParsedSignature,
  indent: string,
  quoteChar: string,
  opts: Partial<DocstringOptions> & { isGenerator?: boolean } = {},
): string {
  const {
    includeTypes = DEFAULT_OPTIONS.includeTypes,
    includeDefaults = DEFAULT_OPTIONS.includeDefaults,
    returnsMode = DEFAULT_OPTIONS.returnsMode,
    summaryPlaceholder = DEFAULT_OPTIONS.summaryPlaceholder,
    descPlaceholder = DEFAULT_OPTIONS.descPlaceholder,
    isGenerator = false,
  } = opts;
  const summaryPeriod = summaryPlaceholder.includes(".") ? "" : ".";
  let out = `${indent}${quoteChar}${summaryPlaceholder}${summaryPeriod}`;

  if (sig.kind === "def" && sig.params.length > 0) {
    out += `\n\n`;
    for (const p of sig.params) {
      const defaultsNote =
        includeDefaults && p.defaultValue ? ` Defaults to ${p.defaultValue}.` : "";
      const descSuffix = defaultsNote && !descPlaceholder.includes(".") ? "." : "";
      out += `${indent}:param ${p.name}: ${descPlaceholder}${descSuffix}${defaultsNote}\n`;
      if (includeTypes && p.annotation) {
        out += `${indent}:type ${p.name}: ${p.annotation}\n`;
      }
    }
  }

  if (!shouldSkipReturn(sig, returnsMode)) {
    const sectionPrefix = out.endsWith("\n") ? "" : "\n\n";
    out += `${sectionPrefix}${indent}:returns: ${descPlaceholder}\n`;
    if (sig.returnAnnotation && sig.returnAnnotation !== "None") {
      out += `${indent}:rtype: ${sig.returnAnnotation}\n`;
    }
  }

  out += out.endsWith("\n") ? `${indent}${quoteChar}` : quoteChar;
  return out;
}

/**
 * Dispatch to the correct snippet-string builder based on `opts.format`.
 * Falls back to Google style for `"auto"`.
 */
export function buildDocstring(
  sig: ParsedSignature,
  indent: string,
  quoteChar: string,
  opts: Partial<DocstringOptions> & { isGenerator?: boolean } = {},
): string {
  switch (opts.format) {
    case "numpy":
      return buildNumpyDocstring(sig, indent, quoteChar, opts);
    case "sphinx":
      return buildSphinxDocstring(sig, indent, quoteChar, opts);
    default:
      return buildGoogleDocstring(sig, indent, quoteChar, opts);
  }
}

/**
 * Dispatch to the correct plain-text builder based on `opts.format`.
 * Falls back to Google style for `"auto"`.
 */
export function buildDocstringText(
  sig: ParsedSignature,
  indent: string,
  quoteChar: string,
  opts: Partial<DocstringOptions> & { isGenerator?: boolean } = {},
): string {
  switch (opts.format) {
    case "numpy":
      return buildNumpyDocstringText(sig, indent, quoteChar, opts);
    case "sphinx":
      return buildSphinxDocstringText(sig, indent, quoteChar, opts);
    default:
      return buildGoogleDocstringText(sig, indent, quoteChar, opts);
  }
}
