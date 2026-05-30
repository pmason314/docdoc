/**
 * Parse Google-style docstrings from Python source lines.
 * No vscode dependency — pure functions only.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A parameter entry from an Args: section. */
export interface ParsedDocstringParam {
  /** Parameter name, including any `*` / `**` prefix. */
  name: string;
  /** Parenthesised type hint — `a (int):` gives `"int"`. Null when absent. */
  typehint: string | null;
  /** Description text; may contain embedded `\n` for multi-line descriptions. */
  description: string;
}

/** A Raises: entry. */
export interface ParsedDocstringRaise {
  exception: string;
  description: string;
}

/** Structured representation of a parsed Google-style docstring. */
export interface ParsedDocstring {
  /** One-line summary. */
  summary: string;
  /** Text between the summary and the first section, if any (rarely used). */
  extendedSummary: string;
  params: ParsedDocstringParam[];
  /** Returns: entry, or null when absent. */
  returns: { typehint: string | null; description: string } | null;
  /** Yields: entry for generator functions, or null when absent. */
  yields: { typehint: string | null; description: string } | null;
  raises: ParsedDocstringRaise[];
  /** Unrecognised sections — preserved verbatim for round-trip fidelity. */
  unknownSections: { header: string; lines: string[] }[];
}

/** Return value of {@link parseGoogleDocstring}. */
export interface DocstringParseResult {
  /** 0-based index of the line containing the opening quotes. */
  startLine: number;
  /** 0-based index of the line containing the closing quotes. */
  endLine: number;
  /** Leading whitespace of the opening-quotes line (the docstring's own indent). */
  indent: string;
  /** `'"""'` or `"'''"`. */
  quoteChar: string;
  parsed: ParsedDocstring;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Find the first `:` in `s` that is not nested inside brackets `()[]{}`.
 * Returns -1 when not found.
 */
function firstColonOutsideBrackets(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === ":" && depth === 0) return i;
  }
  return -1;
}

/**
 * Parse a single entry line:
 * - `name (typehint): description`  →  name + parenthesised typehint
 * - `name: description`             →  name, typehint = null
 * - `complex[type]: description`    →  name = full type, typehint = null
 */
function parseEntryLine(trimmed: string): {
  name: string;
  typehint: string | null;
  description: string;
} {
  // "name (typehint): description" — Args-style with parenthesised type
  const withParen = /^(\*{0,2}[\w]+)\s+\(([^)]+)\)\s*:\s*(.*)$/.exec(trimmed);
  if (withParen) {
    return { name: withParen[1], typehint: withParen[2], description: withParen[3] };
  }

  // "anything: description" — colon-split handles complex type annotations
  const colonIdx = firstColonOutsideBrackets(trimmed);
  if (colonIdx !== -1) {
    return {
      name: trimmed.slice(0, colonIdx).trim(),
      typehint: null,
      description: trimmed.slice(colonIdx + 1).trim(),
    };
  }

  return { name: trimmed, typehint: null, description: "" };
}

/**
 * Parse the raw body lines of a section into individual entries.
 * Lines at exactly `entryIndent` depth start a new entry; deeper lines are
 * continuation lines appended to the previous entry's description.
 */
function parseSectionEntries(
  sectionLines: string[],
  entryIndent: string,
): { name: string; typehint: string | null; description: string }[] {
  const results: { name: string; typehint: string | null; description: string }[] = [];
  let current: { name: string; typehint: string | null; description: string } | null = null;

  for (const raw of sectionLines) {
    const line = raw.trimEnd();
    if (line.trim() === "") continue;

    const leadingWS = line.length - line.trimStart().length;

    if (leadingWS <= entryIndent.length) {
      if (current) results.push(current);
      current = parseEntryLine(line.trimStart());
    } else if (current !== null) {
      // Continuation line — append to current entry's description
      const cont = line.trimStart();
      current.description = current.description ? `${current.description}\n${cont}` : cont;
    }
  }

  if (current) results.push(current);
  return results;
}

function emptyDocstring(summary: string): ParsedDocstring {
  return {
    summary,
    extendedSummary: "",
    params: [],
    returns: null,
    yields: null,
    raises: [],
    unknownSections: [],
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Parse a Google-style docstring whose opening quotes are on `openingLine`.
 *
 * `openingLine` is the 0-based index of the line containing `"""` or `'''`.
 * Returns `null` if that line is not a docstring opening or the docstring is
 * unterminated.
 */
export function parseGoogleDocstring(
  lines: string[],
  openingLine: number,
): DocstringParseResult | null {
  const line0 = lines[openingLine];
  const openMatch = /^(\s*)("""|''')(.*)$/.exec(line0);
  if (!openMatch) return null;

  const [, indent, quoteChar, restRaw] = openMatch;
  const rest = restRaw.trimEnd();
  const entryIndent = indent + "    ";

  // ---- One-liner: """_summary_""" ----
  if (rest.endsWith(quoteChar)) {
    const summary = rest.slice(0, -quoteChar.length).trim();
    return {
      startLine: openingLine,
      endLine: openingLine,
      indent,
      quoteChar,
      parsed: emptyDocstring(summary),
    };
  }

  // ---- Multi-line: scan forward for the closing quotes ----
  let endLine = -1;
  for (let i = openingLine + 1; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith(quoteChar)) {
      endLine = i;
      break;
    }
  }
  if (endLine === -1) return null; // unterminated docstring

  // Summary: text after the opening quotes on the first line;
  // fall back to the next non-blank line if the opening line had nothing.
  let summary = rest.trim();
  let bodyStart = openingLine + 1;
  if (!summary) {
    while (bodyStart < endLine && lines[bodyStart].trim() === "") bodyStart++;
    if (bodyStart < endLine) {
      summary = lines[bodyStart].trim();
      bodyStart++;
    }
  }

  // ---- Group content lines into sections ----
  type RawSection = { header: string; lines: string[] };
  const rawSections: RawSection[] = [];
  const extendedLines: string[] = [];
  let currentSection: RawSection | null = null;

  for (let i = bodyStart; i < endLine; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (line.trim() === "") {
      if (currentSection) currentSection.lines.push("");
      else extendedLines.push("");
      continue;
    }

    const leadingWS = line.length - line.trimStart().length;
    const content = line.trimStart();

    if (leadingWS === indent.length && content.endsWith(":")) {
      // Section header (e.g. "Args:", "Returns:")
      currentSection = { header: content.slice(0, -1), lines: [] };
      rawSections.push(currentSection);
    } else if (currentSection) {
      currentSection.lines.push(raw);
    } else {
      extendedLines.push(line);
    }
  }

  // ---- Build ParsedDocstring from sections ----
  const parsed: ParsedDocstring = {
    ...emptyDocstring(summary),
    extendedSummary: extendedLines.join("\n").replace(/^\n+|\n+$/g, ""),
  };

  for (const section of rawSections) {
    const entries = parseSectionEntries(section.lines, entryIndent);

    switch (section.header) {
      case "Args":
      case "Arguments":
      case "Parameters":
        parsed.params = entries.map((e) => ({
          name: e.name,
          typehint: e.typehint,
          description: e.description,
        }));
        break;

      case "Returns":
      case "Return":
        if (entries.length > 0) {
          // In Google style, Returns entries use "type: desc" (no parentheses);
          // the "name" slot from parseEntryLine holds the type annotation.
          parsed.returns = {
            typehint: entries[0].typehint ?? entries[0].name,
            description: entries[0].description,
          };
        }
        break;

      case "Yields":
      case "Yield":
        if (entries.length > 0) {
          parsed.yields = {
            typehint: entries[0].typehint ?? entries[0].name,
            description: entries[0].description,
          };
        }
        break;

      case "Raises":
        parsed.raises = entries.map((e) => ({
          exception: e.name,
          description: e.description,
        }));
        break;

      default:
        parsed.unknownSections.push({ header: section.header, lines: section.lines });
        break;
    }
  }

  return { startLine: openingLine, endLine, indent, quoteChar, parsed };
}
