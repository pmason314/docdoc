/**
 * Public API for the docstring parser/merger/renderer subsystem.
 */
import type { BuildConfig, Signature } from "../types.js";
import { parseGoogleDocstring } from "./googleParser.js";
import { parseNumpyDocstring } from "./numpyParser.js";
import { parseSphinxDocstring } from "./sphinxParser.js";
import { mergeDocstring } from "./merger.js";
import { renderDocstring } from "./renderer.js";
import type { ParsedDocstring } from "./types.js";

export type { ParsedDocstring };
export type DocstringFormat = "google" | "numpy" | "sphinx";

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

export function parseDocstring(
  docLines: string[],
  startLine: number,
  format: DocstringFormat,
): ParsedDocstring {
  switch (format) {
    case "numpy":
      return parseNumpyDocstring(docLines, startLine);
    case "sphinx":
      return parseSphinxDocstring(docLines, startLine);
    default:
      return parseGoogleDocstring(docLines, startLine);
  }
}

// ---------------------------------------------------------------------------
// Update (parse → merge → render)
// ---------------------------------------------------------------------------

/**
 * Given the source lines of an existing docstring expression_statement,
 * a fresh Signature, and config, return the updated docstring as lines.
 */
export function updateDocstring(
  docLines: string[],
  startLine: number,
  sig: Signature,
  cfg: BuildConfig,
): string[] {
  const parsed = parseDocstring(docLines, startLine, cfg.format);
  const merged = mergeDocstring(parsed, sig, cfg);
  return renderDocstring(merged, cfg.format);
}
