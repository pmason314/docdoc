/**
 * Parse a Google-style docstring from source lines.
 *
 * Input: the full source lines of the expression_statement that holds the
 * docstring (i.e. lines[startLine..endLine], inclusive).
 */
import type {
  ParsedDocstring,
  ParsedParam,
  ParsedRaisesEntry,
  ParsedReturn,
  CustomSection,
} from "./types.js";

// Known sections that hold named-entry lists (param-like)
const PARAM_SECTION_NAMES = new Set(["args", "arguments", "parameters", "params", "attributes"]);
const RAISES_SECTION_NAMES = new Set(["raises", "raise", "except", "exceptions"]);
const RETURNS_SECTION_NAMES = new Set(["returns", "return"]);
const YIELDS_SECTION_NAMES = new Set(["yields", "yield"]);

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseGoogleDocstring(docLines: string[], startLine: number): ParsedDocstring {
  const firstLine = docLines[0] ?? "";
  const indent = firstLine.match(/^(\s*)/)?.[1] ?? "";
  const quotes = firstLine.trimStart().startsWith("'''") ? "'''" : '"""';

  // Normalize: strip base indent, strip opening/closing quotes
  const inner = normalizeLines(docLines, indent, quotes);

  // First line is the summary
  const summary = inner[0] ?? "";
  const rest = inner.slice(1);

  // Split into: extended summary + sections
  const { extendedSummary, sections } = splitSections(rest);

  // Parse sections
  let args: ParsedParam[] = [];
  let returns: ParsedReturn | undefined;
  let yields: ParsedReturn | undefined;
  let raises: ParsedRaisesEntry[] = [];
  const customSections: CustomSection[] = [];

  for (const { header, body } of sections) {
    const key = header.replace(/:$/, "").trim().toLowerCase();

    if (PARAM_SECTION_NAMES.has(key)) {
      args = parseParamEntries(body);
    } else if (RETURNS_SECTION_NAMES.has(key)) {
      returns = parseReturnEntry(body);
    } else if (YIELDS_SECTION_NAMES.has(key)) {
      yields = parseReturnEntry(body);
    } else if (RAISES_SECTION_NAMES.has(key)) {
      raises = parseRaisesEntries(body);
    } else {
      customSections.push({ header, contentLines: body });
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

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Strip base indentation and opening/closing triple-quote characters.
 * Returns the inner content as plain lines (no quotes, no base indent).
 * Closing-quote line is removed.
 */
function normalizeLines(docLines: string[], indent: string, quotes: string): string[] {
  const result: string[] = [];

  for (let i = 0; i < docLines.length; i++) {
    const raw = docLines[i];

    if (i === 0) {
      // Strip indent + opening quotes
      let stripped = raw.trimStart().slice(quotes.length);
      // One-liner: opening and closing quotes on the same line — strip trailing quotes
      if (i === docLines.length - 1) {
        if (stripped.endsWith(quotes)) stripped = stripped.slice(0, -quotes.length);
        result.push(stripped);
        continue;
      }
      result.push(stripped);
      continue;
    }

    if (i === docLines.length - 1) {
      // Last line is the closing quotes (possibly with indent); skip it.
      continue;
    }

    if (raw.trim() === "") {
      result.push("");
    } else if (raw.startsWith(indent)) {
      result.push(raw.slice(indent.length));
    } else {
      result.push(raw); // defensive fallback
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Section splitting
// ---------------------------------------------------------------------------

interface RawSection {
  header: string; // e.g. "Args:"
  body: string[]; // lines belonging to this section (stripped one level)
}

const SECTION_HEADER_RE = /^(\w[\w ]*):$/;

function splitSections(lines: string[]): {
  extendedSummary: string;
  sections: RawSection[];
} {
  const sections: RawSection[] = [];
  let extendedParts: string[] = [];
  let current: RawSection | null = null;

  for (const line of lines) {
    const isHeader = SECTION_HEADER_RE.test(line);

    if (isHeader && line[0] !== " ") {
      // Start of a new section
      current = { header: line, body: [] };
      sections.push(current);
    } else if (current) {
      // Strip one level of indentation from section body
      if (line.trim() === "") {
        current.body.push("");
      } else if (line.startsWith("    ")) {
        current.body.push(line.slice(4));
      } else {
        current.body.push(line);
      }
    } else {
      extendedParts.push(line);
    }
  }

  // Trim trailing blank lines from extendedSummary
  while (extendedParts.length > 0 && extendedParts[extendedParts.length - 1].trim() === "") {
    extendedParts.pop();
  }

  return {
    extendedSummary: extendedParts.join("\n"),
    sections,
  };
}

// ---------------------------------------------------------------------------
// Entry parsers
// ---------------------------------------------------------------------------

// Matches: `name (type): description` or `*name: description` etc.
const PARAM_ENTRY_RE = /^(\*{0,2}\w+)\s*(?:\(([^)]*)\))?:\s*(.*)/;

function parseParamEntries(body: string[]): ParsedParam[] {
  const params: ParsedParam[] = [];
  let current: ParsedParam | null = null;

  for (const line of body) {
    const m = PARAM_ENTRY_RE.exec(line);
    if (m) {
      if (current) params.push(current);
      const rawName = m[1];
      // Determine kind from prefix
      let kind: ParsedParam["kind"] = "regular";
      let name = rawName;
      if (rawName.startsWith("**")) {
        kind = "var_keyword";
        name = rawName.slice(2);
      } else if (rawName.startsWith("*")) {
        kind = "var_positional";
        name = rawName.slice(1);
      }
      current = { name, type: m[2], description: m[3], kind };
    } else if (current) {
      // Continuation line
      const trimmed = line.trim();
      if (trimmed) {
        current.description += "\n" + trimmed;
      }
    }
  }
  if (current) params.push(current);
  return params;
}

// Matches: `type: description` or just `description`
const RETURN_WITH_TYPE_RE = /^(\S.*?):\s+(.*)/;

function parseReturnEntry(body: string[]): ParsedReturn | undefined {
  const content = body
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
  if (!content) return undefined;

  const m = RETURN_WITH_TYPE_RE.exec(content);
  if (m) {
    return { type: m[1], description: m[2] };
  }
  return { description: content };
}

// Matches: `ExceptionType: description`
const RAISES_ENTRY_RE = /^(\w[\w.]*(?:\[.*?\])?)\s*(?:\(.*?\))?:\s*(.*)/;

function parseRaisesEntries(body: string[]): ParsedRaisesEntry[] {
  const raises: ParsedRaisesEntry[] = [];
  let current: ParsedRaisesEntry | null = null;

  for (const line of body) {
    const m = RAISES_ENTRY_RE.exec(line);
    if (m) {
      if (current) raises.push(current);
      current = { type: m[1], description: m[2] };
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed) current.description += "\n" + trimmed;
    }
  }
  if (current) raises.push(current);
  return raises;
}
