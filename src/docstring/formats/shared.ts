/**
 * Shared utilities used by all three format renderers.
 */

import type { FunctionInfo, ClassInfo, Param, Config } from "../../types.js";
import type { RenderOptions } from "../renderer.js";

// ---------------------------------------------------------------------------
// Param filtering helpers
// ---------------------------------------------------------------------------

/** Returns the params that should appear in the docstring. */
export function docParams(params: Param[]): Param[] {
  return params.filter(
    (p) => p.kind !== "positional-only" || true, // positional-only ARE documented
  );
}

/**
 * Determine whether a Returns / Yields section should be emitted.
 */
export function shouldEmitReturn(fn: FunctionInfo, config: Config): "returns" | "yields" | null {
  if (fn.name === "__init__" || fn.name === "__module__") return null;

  const ret = fn.returnAnnotation;

  if (config.returns.skipNone && (ret === "None" || ret === "-> None")) {
    return null;
  }
  if (config.returns.requireAnnotation && !ret) {
    return null;
  }
  if (fn.isGenerator && config.detectGenerators) {
    return "yields";
  }
  return "returns";
}

// ---------------------------------------------------------------------------
// Snippet assembly helpers
// ---------------------------------------------------------------------------

/**
 * Assemble the final snippet string from the body lines.
 *
 * Body lines are the lines that appear between the opening `"""` and the
 * closing `"""`. They do NOT include the opening/closing delimiters and do
 * NOT carry leading indentation (the assembler adds it).
 *
 * - Line[0] is the summary (tab stop $1 already embedded).
 * - Lines after that are section content lines.
 *
 * `$0` is inserted immediately after the last tab stop (identified by the
 * last occurrence of `${` in the body lines).
 */
export function assembleSnippet(
  bodyLines: string[],
  config: Config,
  options: RenderOptions,
): string {
  const { indent, quoteChar: q } = options;

  // Inject $0 after the last tab stop
  injectFinalCursor(bodyLines);

  const isSummaryOnly = bodyLines.length === 1;
  if (isSummaryOnly && config.ruff.collapseOneLiners) {
    // One-liner: """${1:_summary_}$0"""   ($0 may be embedded already above)
    return `${q}${bodyLines[0]}${q}`;
  }

  if (config.ruff.startOnNewLine) {
    // Summary on the line after """
    const first = `${indent}${bodyLines[0]}`;
    const rest = bodyLines.slice(1).map((l) => (l ? `${indent}${l}` : ""));
    return [`${q}`, first, ...rest, `${indent}${q}`].join("\n");
  }

  // Default: summary on the same line as """
  const first = `${q}${bodyLines[0]}`;
  const rest = bodyLines.slice(1).map((l) => (l ? `${indent}${l}` : ""));
  return [first, ...rest, `${indent}${q}`].join("\n");
}

/**
 * Find the last body line that contains a tab stop and append `$0` to it.
 * If no tab stop exists, append `$0` to the last line.
 */
function injectFinalCursor(lines: string[]): void {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes("${")) {
      lines[i] += "$0";
      return;
    }
  }
  // Summary-only with no explicit tab stop marker (plain text — shouldn't
  // happen with our builders, but guard against it).
  lines[lines.length - 1] += "$0";
}

// ---------------------------------------------------------------------------
// Snippet text escaping
// ---------------------------------------------------------------------------

export function escT(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
}

export function escP(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\$/g, "\\$").replace(/}/g, "\\}");
}

/** Emit `${N:placeholder}` using the given counter (mutates counter.n). */
export function tabStop(counter: { n: number }, placeholder = ""): string {
  // Always use the ${N:…} form so injectFinalCursor can find tab stops by
  // scanning for `${` regardless of whether the placeholder is empty.
  return `\${${counter.n++}:${escP(placeholder)}}`;
}

// ---------------------------------------------------------------------------
// Default-value formatting helper
// ---------------------------------------------------------------------------

/** Returns `Defaults to {val}.` or empty string. */
export function defaultsNote(param: Param, config: Config): string {
  if (!config.includeDefaults || !param.default) return "";
  return `Defaults to ${param.default}.`;
}
