// Matches: def foo(...) -> bool:   also handles async def
export const DEF_RE = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(.+?)\s*)?:\s*$/;
// Matches: class Foo:  or  class Foo(Base):
export const CLASS_RE = /^(\s*)class\s+(\w+)/;
// Matches a decorator line
export const DECORATOR_RE = /^\s*@/;

export interface Param {
  name: string;
  annotation: string | null;
  hasDefault: boolean;
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
 * Returns null for a bare "*" separator.
 */
export function parseParam(token: string): Param | null {
  const strippedToken = token.replace(/^\*{1,2}/, "");
  if (!strippedToken) return null; // bare * separator

  const eqIdx = token.indexOf("=");
  const hasDefault = eqIdx !== -1;
  const beforeEq = hasDefault ? token.slice(0, eqIdx).trim() : token.trim();
  const withoutStars = beforeEq.replace(/^\*{1,2}/, "");

  const colonIdx = withoutStars.indexOf(":");
  if (colonIdx !== -1) {
    return {
      name: withoutStars.slice(0, colonIdx).trim(),
      annotation: withoutStars.slice(colonIdx + 1).trim(),
      hasDefault,
    };
  }
  return { name: withoutStars.trim(), annotation: null, hasDefault };
}

/**
 * Scan upward from startLine (inclusive) through a lines array to find the
 * nearest def/class signature, skipping blank lines and decorator lines.
 */
export function findSignatureFromLines(lines: string[], startLine: number): ParsedSignature | null {
  for (let i = startLine; i >= 0 && i >= startLine - 30; i--) {
    const text = lines[i];

    const defMatch = DEF_RE.exec(text);
    if (defMatch) {
      const rawParams = defMatch[3] ?? "";
      const returnStr = defMatch[4] ?? null;

      const params: Param[] = [];
      for (const token of splitParams(rawParams)) {
        const p = parseParam(token);
        if (!p) continue;
        if (p.name === "self" || p.name === "cls") continue;
        params.push(p);
      }

      return {
        kind: "def",
        name: defMatch[2],
        params,
        returnAnnotation: returnStr,
      };
    }

    const classMatch = CLASS_RE.exec(text);
    if (classMatch) {
      return { kind: "class", name: classMatch[2], params: [], returnAnnotation: null };
    }

    // Keep scanning through blank lines and decorators; stop on anything else
    if (text.trim() !== "" && !DECORATOR_RE.test(text)) {
      break;
    }
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
 * Build a Google-style docstring as a raw VS Code snippet template string.
 *
 * Example output for def foo(a: int) -> bool with indent="    ":
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
  indent: string,
  quoteChar: string,
): string {
  const paramIndent = indent + "    ";
  let n = 1;
  let out = `\${${n++}:_summary_}`;

  if (sig.kind === "def" && sig.params.length > 0) {
    out += `\n\n${indent}Args:\n`;
    for (const p of sig.params) {
      const typeHint = p.annotation ? ` (${p.annotation})` : "";
      out += `${paramIndent}${p.name}${typeHint}: \${${n++}:_description_}\n`;
    }
  }

  const skipReturn =
    sig.kind !== "def" || sig.returnAnnotation === null || sig.returnAnnotation === "None";

  if (!skipReturn) {
    out += `\n${indent}Returns:\n`;
    out += `${paramIndent}${sig.returnAnnotation}: \${${n++}:_description_}\n`;
  }

  out += `${indent}${quoteChar}`;
  return out;
}
