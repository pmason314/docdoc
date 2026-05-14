/**
 * Resolved Ruff style settings that affect docstring generation.
 * Zero VS Code API dependency — operates on raw file content strings.
 */
export interface RuffStyle {
  /** If true, summary goes on the line after opening """. If false, summary starts on same line. */
  startOnNewLine: boolean;
  /** If true, summary-only docstrings collapse to a single line (D200). */
  collapseOneLiners: boolean;
}

export const DEFAULT_RUFF_STYLE: RuffStyle = {
  startOnNewLine: false,
  collapseOneLiners: true,
};

type TomlValue = string | number | boolean | TomlTable | TomlValue[];
interface TomlTable {
  [key: string]: TomlValue | undefined;
}

async function parseTomlContent(content: string): Promise<TomlTable> {
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

function toStringArray(value: TomlValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * Determine whether a rule is effectively active given select/ignore/extend-select/extend-ignore arrays.
 */
function isRuleActive(
  rule: string,
  select: string[],
  ignore: string[],
  extendSelect: string[],
  extendIgnore: string[],
): boolean | null {
  // extend-ignore takes highest priority for disabling
  if (extendIgnore.includes(rule)) return false;
  // extend-select takes priority for enabling
  if (extendSelect.includes(rule)) return true;
  // explicit ignore
  if (ignore.includes(rule)) return false;
  // explicit select
  if (select.includes(rule)) return true;
  // Check prefix matches (e.g., "D" or "D2" selects D200)
  for (const s of [...select, ...extendSelect]) {
    if (rule.startsWith(s)) return true;
  }
  for (const i of [...ignore, ...extendIgnore]) {
    if (rule.startsWith(i)) return false;
  }
  return null; // not explicitly configured
}

/**
 * Extract Ruff lint rule arrays from a parsed TOML object at a given base path.
 * For pyproject.toml the base is ["tool", "ruff", "lint"], for ruff.toml it's ["lint"].
 */
function extractRuleArrays(parsed: TomlTable, basePath: string[]) {
  const select = toStringArray(getNestedValue(parsed, [...basePath, "select"]));
  const ignore = toStringArray(getNestedValue(parsed, [...basePath, "ignore"]));
  const extendSelect = toStringArray(getNestedValue(parsed, [...basePath, "extend-select"]));
  const extendIgnore = toStringArray(getNestedValue(parsed, [...basePath, "extend-ignore"]));
  return { select, ignore, extendSelect, extendIgnore };
}

function resolveStyle(
  select: string[],
  ignore: string[],
  extendSelect: string[],
  extendIgnore: string[],
): RuffStyle {
  const style = { ...DEFAULT_RUFF_STYLE };

  // D212 = summary on same line as opening """.
  // D213 = summary on line after opening """.
  // If D213 is active (selected) OR D212 is inactive (ignored), use startOnNewLine.
  const d212Active = isRuleActive("D212", select, ignore, extendSelect, extendIgnore);
  const d213Active = isRuleActive("D213", select, ignore, extendSelect, extendIgnore);

  if (d213Active === true || d212Active === false) {
    style.startOnNewLine = true;
  }

  // D200 = one-liner docstrings. Active by default under all conventions.
  const d200Active = isRuleActive("D200", select, ignore, extendSelect, extendIgnore);
  if (d200Active === false) {
    style.collapseOneLiners = false;
  }

  return style;
}

/**
 * Detect Ruff style settings from pyproject.toml content.
 */
export async function detectRuffStyleFromPyprojectToml(content: string): Promise<RuffStyle> {
  let parsed: TomlTable;
  try {
    parsed = await parseTomlContent(content);
  } catch {
    return DEFAULT_RUFF_STYLE;
  }

  const { select, ignore, extendSelect, extendIgnore } = extractRuleArrays(parsed, [
    "tool",
    "ruff",
    "lint",
  ]);
  return resolveStyle(select, ignore, extendSelect, extendIgnore);
}

/**
 * Detect Ruff style settings from ruff.toml content.
 */
export async function detectRuffStyleFromRuffToml(content: string): Promise<RuffStyle> {
  let parsed: TomlTable;
  try {
    parsed = await parseTomlContent(content);
  } catch {
    return DEFAULT_RUFF_STYLE;
  }

  const { select, ignore, extendSelect, extendIgnore } = extractRuleArrays(parsed, ["lint"]);
  return resolveStyle(select, ignore, extendSelect, extendIgnore);
}
