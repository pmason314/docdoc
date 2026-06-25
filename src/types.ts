/** How a parameter is passed to a function. */
export type ParamKind =
  | "regular" // positional-or-keyword
  | "positional_only" // before /
  | "keyword_only" // after * or *args
  | "var_positional" // *args
  | "var_keyword"; // **kwargs

export interface Param {
  name: string;
  type?: string;
  default?: string;
  kind: ParamKind;
}

export interface Signature {
  kind: "function" | "class";
  name: string;
  params: Param[]; // self / cls excluded
  returnType?: string;
  hasReturnValue: boolean; // body contains `return <expr>` (not bare return)
  isAsync: boolean;
  isGenerator: boolean;
  raises: string[]; // deduplicated exception names
  decorators: string[]; // decorator texts (without leading @)
  // Line numbers are 0-based
  startLine: number; // first line (decorator or def/class keyword)
  defLine: number; // line of def / class keyword
  bodyStartLine: number; // first line of body block
  bodyEndLine: number; // last line of body block (inclusive)
}

/** A docstring insertion: insert `lines` after source line `afterLine`. */
export interface Insertion {
  afterLine: number; // 0-based
  lines: string[];
}

/** A docstring replacement: replace source lines [startLine, endLine] (inclusive) with newLines. */
export interface Replacement {
  startLine: number; // 0-based, inclusive
  endLine: number; // 0-based, inclusive
  newLines: string[];
}

export interface BuildConfig {
  format: "google" | "numpy" | "sphinx";
  quoteStyle: "double" | "single";
  includeTypes: boolean;
  includeDefaults: boolean;
  returnsMode: "always" | "auto";
  generateModuleDocstring: boolean;
  placeholderSummary: string;
  placeholderDescription: string;
}

export const DEFAULT_CONFIG: BuildConfig = {
  format: "google",
  quoteStyle: "double",
  includeTypes: true,
  includeDefaults: true,
  returnsMode: "auto",
  generateModuleDocstring: true,
  placeholderSummary: "_summary_",
  placeholderDescription: "_description_",
};
