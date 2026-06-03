/**
 * Parse a Sphinx / reStructuredText-style docstring.
 *
 *   :param name: description
 *   :type name: type
 *   :returns: description
 *   :rtype: type
 *   :raises ExcType: description
 */
import type {
  CustomSection,
  ParsedDocstring,
  ParsedParam,
  ParsedRaisesEntry,
  ParsedReturn,
} from "./types.js";

export function parseSphinxDocstring(docLines: string[], startLine: number): ParsedDocstring {
  const firstLine = docLines[0] ?? "";
  const indent = firstLine.match(/^(\s*)/)?.[1] ?? "";
  const quotes = firstLine.trimStart().startsWith("'''") ? "'''" : '"""';

  const inner = normalizeLines(docLines, indent, quotes);
  const summary = inner[0] ?? "";
  const rest = inner.slice(1);

  const { extendedSummary, fields } = parseSphinxFields(rest);

  // Build param map (merge :param and :type)
  const paramMap = new Map<string, { desc: string; type?: string; kind: ParsedParam["kind"] }>();
  let returnDesc = "";
  let returnType: string | undefined;
  let yieldDesc = "";
  let yieldType: string | undefined;
  const raises: ParsedRaisesEntry[] = [];
  const customSections: CustomSection[] = [];

  for (const { tag, name, value } of fields) {
    if (tag === "param" || tag === "parameter" || tag === "arg") {
      const rawName = name ?? "";
      let kind: ParsedParam["kind"] = "regular";
      let n = rawName;
      if (rawName.startsWith("**")) {
        kind = "var_keyword";
        n = rawName.slice(2);
      } else if (rawName.startsWith("*")) {
        kind = "var_positional";
        n = rawName.slice(1);
      }
      const existing = paramMap.get(n) ?? { desc: "", kind };
      paramMap.set(n, { ...existing, desc: value, kind });
    } else if (tag === "type") {
      const n = name ?? "";
      const existing = paramMap.get(n) ?? { desc: "", kind: "regular" as ParsedParam["kind"] };
      paramMap.set(n, { ...existing, type: value });
    } else if (tag === "returns" || tag === "return") {
      returnDesc = value;
    } else if (tag === "rtype") {
      returnType = value;
    } else if (tag === "yields" || tag === "yield") {
      yieldDesc = value;
    } else if (tag === "ytype") {
      yieldType = value;
    } else if (tag === "raises" || tag === "raise" || tag === "except") {
      raises.push({ type: name ?? tag, description: value });
    } else {
      // Unknown field -> custom section
      customSections.push({
        header: name ? `:${tag} ${name}:` : `:${tag}:`,
        contentLines: [value],
      });
    }
  }

  const args: ParsedParam[] = Array.from(paramMap.entries()).map(([nm, v]) => ({
    name: nm,
    type: v.type,
    description: v.desc,
    kind: v.kind,
  }));

  const returns: ParsedReturn | undefined =
    returnDesc || returnType ? { type: returnType, description: returnDesc } : undefined;
  const yields: ParsedReturn | undefined =
    yieldDesc || yieldType ? { type: yieldType, description: yieldDesc } : undefined;

  return {
    summary,
    extendedSummary,
    args,
    returns,
    yields,
    raises,
    customSections,
    startLine,
    endLine: startLine + docLines.length - 1,
    indent,
    quotes,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeLines(docLines: string[], indent: string, quotes: string): string[] {
  return docLines
    .map((raw, i) => {
      if (i === 0) return raw.trimStart().slice(quotes.length);
      if (i === docLines.length - 1) return null as unknown as string; // will be filtered
      return raw.trim() === "" ? "" : raw.startsWith(indent) ? raw.slice(indent.length) : raw;
    })
    .filter((l): l is string => l !== null);
}

interface SphinxField {
  tag: string;
  name?: string;
  value: string;
}

// :tag name: value   or   :tag: value
const FIELD_RE = /^:(\w+)(?:\s+([^:]+))?:\s*(.*)/;

function parseSphinxFields(lines: string[]): {
  extendedSummary: string;
  fields: SphinxField[];
} {
  const extended: string[] = [];
  const fields: SphinxField[] = [];
  let current: SphinxField | null = null;
  let inFields = false;

  for (const line of lines) {
    const m = FIELD_RE.exec(line);
    if (m) {
      inFields = true;
      if (current) fields.push(current);
      current = { tag: m[1], name: m[2]?.trim(), value: m[3] };
    } else if (current) {
      // Continuation line
      const t = line.trim();
      if (t) current.value += " " + t;
    } else if (!inFields) {
      extended.push(line);
    }
  }
  if (current) fields.push(current);

  while (extended.length > 0 && extended[extended.length - 1].trim() === "") extended.pop();
  return { extendedSummary: extended.join("\n"), fields };
}
