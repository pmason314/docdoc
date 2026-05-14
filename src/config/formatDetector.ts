import type { DocstringFormat } from "../types.js";

/**
 * Detects docstring format convention from TOML config file content.
 * Zero VS Code API dependency — operates on raw file content strings.
 */

type TomlValue = string | number | boolean | TomlTable | TomlValue[];
interface TomlTable {
  [key: string]: TomlValue | undefined;
}

async function parseToml(content: string): Promise<TomlTable> {
  const { parse } = await import("smol-toml");
  return parse(content) as unknown as TomlTable;
}

function getNestedValue(obj: TomlTable, path: string[]): TomlValue | undefined {
  let current: TomlValue | undefined = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as TomlTable)[key];
  }
  return current;
}

/**
 * Maps a convention string from config tools to a DocstringFormat.
 * Returns null if the convention is unrecognized.
 */
function mapConvention(convention: string): DocstringFormat | null {
  const normalized = convention.toLowerCase().trim();
  switch (normalized) {
    case "google":
      return "google";
    case "numpy":
      return "numpy";
    case "pep257":
      // pep257 is closest to Google for generation purposes
      return "google";
    default:
      return null;
  }
}

/**
 * Detect docstring format from pyproject.toml content.
 * Checks in order:
 * 1. [tool.ruff.lint.pydocstyle] convention
 * 2. [tool.pydocstyle] convention
 * 3. [tool.pylint.format] docstring-convention (uses "default" as convention value name)
 */
export async function detectFormatFromPyprojectToml(content: string): Promise<DocstringFormat | null> {
  let parsed: TomlTable;
  try {
    parsed = await parseToml(content);
  } catch {
    return null;
  }

  // 1. [tool.ruff.lint.pydocstyle] convention
  const ruffConvention = getNestedValue(parsed, [
    "tool",
    "ruff",
    "lint",
    "pydocstyle",
    "convention",
  ]);
  if (typeof ruffConvention === "string") {
    const format = mapConvention(ruffConvention);
    if (format) return format;
  }

  // 2. [tool.pydocstyle] convention
  const pydocstyleConvention = getNestedValue(parsed, ["tool", "pydocstyle", "convention"]);
  if (typeof pydocstyleConvention === "string") {
    const format = mapConvention(pydocstyleConvention);
    if (format) return format;
  }

  // 3. [tool.pylint.format] docstring-convention
  const pylintConvention = getNestedValue(parsed, [
    "tool",
    "pylint",
    "format",
    "docstring-convention",
  ]);
  if (typeof pylintConvention === "string") {
    const format = mapConvention(pylintConvention);
    if (format) return format;
  }

  return null;
}

/**
 * Detect docstring format from ruff.toml content.
 * Checks [lint.pydocstyle] convention.
 */
export async function detectFormatFromRuffToml(content: string): Promise<DocstringFormat | null> {
  let parsed: TomlTable;
  try {
    parsed = await parseToml(content);
  } catch {
    return null;
  }

  const convention = getNestedValue(parsed, ["lint", "pydocstyle", "convention"]);
  if (typeof convention === "string") {
    return mapConvention(convention);
  }

  return null;
}

/**
 * Detect docstring format from setup.cfg content.
 * Checks [pydocstyle] convention using simple INI-style parsing.
 */
export function detectFormatFromSetupCfg(content: string): DocstringFormat | null {
  let inPydocstyleSection = false;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    // Section header
    if (line.startsWith("[")) {
      inPydocstyleSection = line.toLowerCase() === "[pydocstyle]";
      continue;
    }

    if (inPydocstyleSection && line.startsWith("convention")) {
      const match = line.match(/^convention\s*=\s*(.+)/);
      if (match) {
        return mapConvention(match[1]);
      }
    }
  }

  return null;
}
