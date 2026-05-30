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
 * Returns null for a bare "*" separator. Preserves "*"/"**" prefix in the returned name.
 */
export function parseParam(token: string): Param | null {
  // Extract leading * or ** (preserved in name so *args / **kwargs display correctly)
  const starsMatch = token.match(/^(\*{1,2})/);
  const stars = starsMatch ? starsMatch[1] : "";
  const withoutLeadingStars = token.slice(stars.length);

  if (!withoutLeadingStars.trim()) return null; // bare * separator

  const eqIdx = withoutLeadingStars.indexOf("=");
  const hasDefault = eqIdx !== -1;
  const beforeEq = hasDefault
    ? withoutLeadingStars.slice(0, eqIdx).trim()
    : withoutLeadingStars.trim();

  const colonIdx = beforeEq.indexOf(":");
  if (colonIdx !== -1) {
    return {
      name: stars + beforeEq.slice(0, colonIdx).trim(),
      annotation: beforeEq.slice(colonIdx + 1).trim(),
      hasDefault,
    };
  }
  return { name: stars + beforeEq.trim(), annotation: null, hasDefault };
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
  opts: { isGenerator?: boolean } = {},
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
    const sectionLabel = opts.isGenerator ? "Yields" : "Returns";
    out += `\n${indent}${sectionLabel}:\n`;
    out += `${paramIndent}${sig.returnAnnotation}: \${${n++}:_description_}\n`;
  }

  out += `${indent}${quoteChar}`;
  return out;
}
