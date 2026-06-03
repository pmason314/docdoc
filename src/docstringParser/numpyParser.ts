/**
 * Parse a NumPy-style docstring.
 *
 * NumPy sections use an underline of dashes:
 *
 *   Parameters
 *   ----------
 *   x : int
 *       description
 */
import type {
  CustomSection,
  ParsedDocstring,
  ParsedParam,
  ParsedRaisesEntry,
  ParsedReturn,
} from "./types.js";

const PARAM_SECTIONS = new Set(["parameters", "params", "arguments", "args", "attributes"]);
const RAISES_SECTIONS = new Set(["raises", "raise", "except", "exceptions"]);
const RETURNS_SECTIONS = new Set(["returns", "return"]);
const YIELDS_SECTIONS = new Set(["yields", "yield"]);

export function parseNumpyDocstring(docLines: string[], startLine: number): ParsedDocstring {
  const firstLine = docLines[0] ?? "";
  const indent = firstLine.match(/^(\s*)/)?.[1] ?? "";
  const quotes = firstLine.trimStart().startsWith("'''") ? "'''" : '"""';

  const inner = normalizeLines(docLines, indent, quotes);
  const summary = inner[0] ?? "";
  const rest = inner.slice(1);

  const { extendedSummary, sections } = splitNumpySections(rest);

  let args: ParsedParam[] = [];
  let returns: ParsedReturn | undefined;
  let yields: ParsedReturn | undefined;
  let raises: ParsedRaisesEntry[] = [];
  const customSections: CustomSection[] = [];

  for (const { header, body } of sections) {
    const key = header.trim().toLowerCase();
    if (PARAM_SECTIONS.has(key)) {
      args = parseNumpyParams(body);
    } else if (RETURNS_SECTIONS.has(key)) {
      returns = parseNumpyReturn(body);
    } else if (YIELDS_SECTIONS.has(key)) {
      yields = parseNumpyReturn(body);
    } else if (RAISES_SECTIONS.has(key)) {
      raises = parseNumpyRaises(body);
    } else {
      customSections.push({
        header: header + "\n" + "-".repeat(header.length),
        contentLines: body,
      });
    }
  }

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

function normalizeLines(docLines: string[], indent: string, quotes: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < docLines.length; i++) {
    const raw = docLines[i];
    if (i === 0) {
      result.push(raw.trimStart().slice(quotes.length));
      continue;
    }
    if (i === docLines.length - 1) continue; // closing quotes line
    result.push(raw.trim() === "" ? "" : raw.startsWith(indent) ? raw.slice(indent.length) : raw);
  }
  return result;
}

interface RawSection {
  header: string;
  body: string[];
}

function splitNumpySections(lines: string[]): { extendedSummary: string; sections: RawSection[] } {
  const sections: RawSection[] = [];
  const extended: string[] = [];
  let current: RawSection | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // A section header is a non-blank line followed by a line of dashes
    if (line.trim() !== "" && i + 1 < lines.length && /^-{2,}$/.test(lines[i + 1].trim())) {
      current = { header: line.trim(), body: [] };
      sections.push(current);
      i += 2; // skip header + underline
      continue;
    }

    if (current) {
      if (line.trim() === "") {
        current.body.push("");
      } else if (line.startsWith("    ")) {
        current.body.push(line.slice(4));
      } else {
        current.body.push(line);
      }
    } else {
      extended.push(line);
    }
    i++;
  }

  while (extended.length > 0 && extended[extended.length - 1].trim() === "") extended.pop();

  return { extendedSummary: extended.join("\n"), sections };
}

function parseNumpyParams(body: string[]): ParsedParam[] {
  const params: ParsedParam[] = [];
  let current: ParsedParam | null = null;
  let parsingDesc = false;

  for (const line of body) {
    if (line.trim() === "") {
      parsingDesc = false;
      continue;
    }

    // Entry: "name : type" or "name"
    if (!line.startsWith("    ") && !line.startsWith("\t")) {
      if (current) params.push(current);
      const colonIdx = line.indexOf(" : ");
      const rawName = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line.trim();
      const type = colonIdx >= 0 ? line.slice(colonIdx + 3).trim() : undefined;

      let kind: ParsedParam["kind"] = "regular";
      let name = rawName;
      if (rawName.startsWith("**")) {
        kind = "var_keyword";
        name = rawName.slice(2);
      } else if (rawName.startsWith("*")) {
        kind = "var_positional";
        name = rawName.slice(1);
      }

      current = { name, type, description: "", kind };
      parsingDesc = true;
    } else if (current && parsingDesc) {
      const trimmed = line.trim();
      current.description = current.description ? current.description + "\n" + trimmed : trimmed;
    }
  }
  if (current) params.push(current);
  return params;
}

function parseNumpyReturn(body: string[]): ParsedReturn | undefined {
  // First non-indented, non-blank line is the type; following indented lines are description
  let type: string | undefined;
  let desc = "";

  for (const line of body) {
    if (line.trim() === "") continue;
    if (!line.startsWith("    ") && type === undefined) {
      type = line.trim();
    } else {
      desc = desc ? desc + "\n" + line.trim() : line.trim();
    }
  }

  if (!type && !desc) return undefined;
  // If there's only description (no type line), treat it as description-only
  if (type && !desc) return { type, description: "" };
  if (!type) return { description: desc };
  return { type, description: desc };
}

function parseNumpyRaises(body: string[]): ParsedRaisesEntry[] {
  const raises: ParsedRaisesEntry[] = [];
  let current: ParsedRaisesEntry | null = null;

  for (const line of body) {
    if (line.trim() === "") continue;
    if (!line.startsWith("    ")) {
      if (current) raises.push(current);
      current = { type: line.trim(), description: "" };
    } else if (current) {
      const t = line.trim();
      current.description = current.description ? current.description + "\n" + t : t;
    }
  }
  if (current) raises.push(current);
  return raises;
}
