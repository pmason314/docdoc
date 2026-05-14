/**
 * Core type definitions shared across all phases.
 * This module has zero VS Code API dependencies.
 */

// --- Signature types ---

export type ParamKind = "positional-only" | "regular" | "keyword-only" | "args" | "kwargs";

export interface Param {
  name: string;
  kind: ParamKind;
  /** Raw annotation text from source, e.g. "dict[str, list[int]]" */
  annotation: string | null;
  /** Raw default value text from source */
  default: string | null;
  isOptional: boolean;
}

/** PEP 695 type parameter: def f[T, S: str](x: T) -> S */
export interface TypeParam {
  name: string;
  bound: string | null;
  variance: "TypeVar" | "TypeVarTuple" | "ParamSpec";
}

/** A simple line/column range with no VS Code dependency. */
export interface SourceRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface FunctionInfo {
  kind: "function";
  name: string;
  params: Param[];
  returnAnnotation: string | null;
  decorators: string[];
  isAsync: boolean;
  isGenerator: boolean;
  typeParams: TypeParam[];
  docstring: string | null;
  bodyRange: SourceRange;
  signatureRange: SourceRange;
  scopeLevel: "module" | "class" | "function";
}

export interface ClassInfo {
  kind: "class";
  name: string;
  decorators: string[];
  typeParams: TypeParam[];
  attributes: ClassAttribute[];
  /** Populated when mergeInitParams is true */
  initParams: Param[];
  docstring: string | null;
  bodyRange: SourceRange;
  signatureRange: SourceRange;
}

export interface ClassAttribute {
  name: string;
  annotation: string | null;
  isClassVar: boolean;
}

export type DocstringTarget = FunctionInfo | ClassInfo;

// --- Docstring format types ---

export type DocstringFormat = "google" | "numpy" | "sphinx";

export interface ParsedParam {
  name: string;
  type: string | null;
  description: string;
}

export interface ParsedReturn {
  type: string | null;
  description: string;
}

export interface ParsedRaise {
  type: string;
  description: string;
}

export interface ParsedAttribute {
  name: string;
  type: string | null;
  description: string;
}

export interface CustomSection {
  header: string;
  content: string;
}

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

// --- Configuration types ---

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
    startOnNewLine: boolean;
    collapseOneLiners: boolean;
  };
  trigger: {
    tripleQuote: boolean;
    codeAction: boolean;
  };
  onSave: {
    enable: boolean;
  };
}

export const DEFAULT_CONFIG: Config = {
  format: "google",
  quoteStyle: "double",
  includeTypesFromAnnotations: true,
  includeDefaults: true,
  includeExtendedSummary: false,
  returns: {
    skipNone: true,
    requireAnnotation: true,
  },
  detectGenerators: true,
  raises: {
    useSubprocess: true,
    useSimpleScan: true,
  },
  mergeInitParams: false,
  includeClassAttributes: true,
  update: {
    removeStaleParams: true,
  },
  placeholders: {
    summary: "_summary_",
    description: "",
  },
  pythonPath: "",
  ai: {
    generateSummary: false,
    generateParamDescriptions: false,
    generateReturnDescription: false,
    includeBodyContext: false,
    maxBodyTokens: 500,
    modelFamily: "",
  },
  ruff: {
    startOnNewLine: false,
    collapseOneLiners: true,
  },
  trigger: {
    tripleQuote: true,
    codeAction: true,
  },
  onSave: {
    enable: false,
  },
};
