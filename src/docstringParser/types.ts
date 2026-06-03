import type { ParamKind } from "../types.js";

/** One parameter entry from a parsed docstring. */
export interface ParsedParam {
  name: string;
  type?: string;
  description: string; // may be multi-line; newlines preserved
  kind: ParamKind;
}

export interface ParsedReturn {
  type?: string;
  description: string;
}

export interface ParsedRaisesEntry {
  type: string;
  description: string;
}

/** A non-standard section (Notes, Examples, See Also, …) preserved verbatim. */
export interface CustomSection {
  /** Header text including the trailing colon, e.g. "Notes:" */
  header: string;
  /** Content lines with leading indentation stripped to one level (4 spaces). */
  contentLines: string[];
}

/** Structured representation of a parsed docstring. */
export interface ParsedDocstring {
  summary: string;
  extendedSummary: string; // blank-line-separated text before first section
  args: ParsedParam[];
  returns?: ParsedReturn;
  yields?: ParsedReturn;
  raises: ParsedRaisesEntry[];
  customSections: CustomSection[];
  // Source location (0-based line numbers in the full file)
  startLine: number; // expression_statement start
  endLine: number; // expression_statement end
  // Formatting metadata
  indent: string; // base indentation of the triple-quote line
  quotes: string; // '"""' or "'''"
}
