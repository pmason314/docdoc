/**
 * Render a ParsedDocstring back to source lines in the three supported formats.
 */
import type {
  ParsedDocstring,
  ParsedParam,
  ParsedReturn,
  ParsedRaisesEntry,
  CustomSection,
} from "./types.js";

type Format = "google" | "numpy" | "sphinx";

export function renderDocstring(parsed: ParsedDocstring, format: Format): string[] {
  switch (format) {
    case "numpy":
      return renderNumpy(parsed);
    case "sphinx":
      return renderSphinx(parsed);
    default:
      return renderGoogle(parsed);
  }
}

// ---------------------------------------------------------------------------
// Google renderer
// ---------------------------------------------------------------------------

function renderGoogle(p: ParsedDocstring): string[] {
  const { indent, quotes, summary } = p;
  const hasSections =
    p.args.length > 0 ||
    p.returns ||
    p.yields ||
    p.raises.length > 0 ||
    p.customSections.length > 0;
  const hasExtended = p.extendedSummary.trim() !== "";

  if (!hasSections && !hasExtended) {
    return [`${indent}${quotes}${summary}${quotes}`];
  }

  const lines: string[] = [];
  lines.push(`${indent}${quotes}${summary}`);

  if (hasExtended) {
    lines.push("");
    for (const l of p.extendedSummary.split("\n")) {
      lines.push(l.trim() === "" ? "" : `${indent}${l}`);
    }
  }

  const sections: string[][] = [];

  if (p.args.length > 0) sections.push(renderGoogleArgs(p.args, indent));
  const retSection = renderGoogleReturn(
    p.returns ?? p.yields,
    indent,
    p.yields ? "Yields" : "Returns",
  );
  if (retSection) sections.push(retSection);
  if (p.raises.length > 0) sections.push(renderGoogleRaises(p.raises, indent));
  for (const cs of p.customSections) sections.push(renderGoogleCustom(cs, indent));

  for (const section of sections) {
    lines.push("");
    lines.push(...section);
  }

  lines.push(`${indent}${quotes}`);
  return lines;
}

function renderGoogleArgs(args: ParsedParam[], indent: string): string[] {
  const lines = [`${indent}Args:`];
  for (const arg of args) {
    const displayName =
      arg.kind === "var_positional"
        ? `*${arg.name}`
        : arg.kind === "var_keyword"
          ? `**${arg.name}`
          : arg.name;
    const typePart = arg.type ? ` (${arg.type})` : "";
    const firstLine = `${indent}    ${displayName}${typePart}: ${arg.description.split("\n")[0]}`;
    lines.push(firstLine);
    for (const cont of arg.description.split("\n").slice(1)) {
      lines.push(`${indent}        ${cont}`);
    }
  }
  return lines;
}

function renderGoogleReturn(
  ret: ParsedReturn | undefined,
  indent: string,
  header: string,
): string[] | null {
  if (!ret) return null;
  // None returns are self-documenting — omit the description and colon.
  if (ret.type === "None") {
    return [`${indent}${header}:`, `${indent}    None`];
  }
  const typePart = ret.type ? `${ret.type}: ` : "";
  return [`${indent}${header}:`, `${indent}    ${typePart}${ret.description}`];
}

function renderGoogleRaises(raises: ParsedRaisesEntry[], indent: string): string[] {
  const lines = [`${indent}Raises:`];
  for (const r of raises) {
    lines.push(`${indent}    ${r.type}: ${r.description}`);
  }
  return lines;
}

function renderGoogleCustom(cs: CustomSection, indent: string): string[] {
  // Trim trailing blank lines to avoid double-blank-lines between adjacent sections.
  let end = cs.contentLines.length;
  while (end > 0 && cs.contentLines[end - 1].trim() === "") end--;

  const lines = [`${indent}${cs.header}`];
  for (let i = 0; i < end; i++) {
    const l = cs.contentLines[i];
    lines.push(l.trim() === "" ? "" : `${indent}    ${l}`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// NumPy renderer
// ---------------------------------------------------------------------------

function renderNumpy(p: ParsedDocstring): string[] {
  const { indent, quotes, summary } = p;
  const hasSections =
    p.args.length > 0 ||
    p.returns ||
    p.yields ||
    p.raises.length > 0 ||
    p.customSections.length > 0;

  if (!hasSections && p.extendedSummary.trim() === "") {
    return [`${indent}${quotes}${summary}${quotes}`];
  }

  const lines: string[] = [`${indent}${quotes}${summary}`];

  if (p.extendedSummary.trim()) {
    lines.push("");
    for (const l of p.extendedSummary.split("\n")) {
      lines.push(l.trim() === "" ? "" : `${indent}${l}`);
    }
  }

  if (p.args.length > 0) {
    lines.push("", `${indent}Parameters`, `${indent}----------`);
    for (const arg of p.args) {
      const displayName =
        arg.kind === "var_positional"
          ? `*${arg.name}`
          : arg.kind === "var_keyword"
            ? `**${arg.name}`
            : arg.name;
      const typePart = arg.type ? ` : ${arg.type}` : "";
      lines.push(`${indent}${displayName}${typePart}`);
      for (const dl of arg.description.split("\n")) {
        lines.push(`${indent}    ${dl}`);
      }
    }
  }

  const retEntry = p.returns ?? p.yields;
  const retHeader = p.yields ? "Yields" : "Returns";
  if (retEntry) {
    const dashes = "-".repeat(retHeader.length);
    lines.push("", `${indent}${retHeader}`, `${indent}${dashes}`);
    if (retEntry.type) lines.push(`${indent}${retEntry.type}`);
    lines.push(`${indent}    ${retEntry.description}`);
  }

  if (p.raises.length > 0) {
    lines.push("", `${indent}Raises`, `${indent}------`);
    for (const r of p.raises) {
      lines.push(`${indent}${r.type}`);
      lines.push(`${indent}    ${r.description}`);
    }
  }

  for (const cs of p.customSections) {
    const rawHeader = cs.header.replace(/\n-+$/, "");
    const dashes = "-".repeat(rawHeader.length);
    lines.push("", `${indent}${rawHeader}`, `${indent}${dashes}`);
    for (const l of cs.contentLines) lines.push(`${indent}    ${l}`);
  }

  lines.push(`${indent}${quotes}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Sphinx renderer
// ---------------------------------------------------------------------------

function renderSphinx(p: ParsedDocstring): string[] {
  const { indent, quotes, summary } = p;
  const lines: string[] = [`${indent}${quotes}${summary}`];

  if (p.extendedSummary.trim()) {
    lines.push("");
    for (const l of p.extendedSummary.split("\n")) {
      lines.push(l.trim() === "" ? "" : `${indent}${l}`);
    }
  }

  const bodyLines: string[] = [];

  for (const arg of p.args) {
    const displayName =
      arg.kind === "var_positional"
        ? `*${arg.name}`
        : arg.kind === "var_keyword"
          ? `**${arg.name}`
          : arg.name;
    bodyLines.push(`${indent}:param ${displayName}: ${arg.description}`);
    if (arg.type) bodyLines.push(`${indent}:type ${displayName}: ${arg.type}`);
  }

  const retEntry = p.returns ?? p.yields;
  if (retEntry) {
    const retLabel = p.yields ? "yields" : "returns";
    bodyLines.push(`${indent}:${retLabel}: ${retEntry.description}`);
    if (retEntry.type) {
      const rtypeLabel = p.yields ? "ytype" : "rtype";
      bodyLines.push(`${indent}:${rtypeLabel}: ${retEntry.type}`);
    }
  }

  for (const r of p.raises) {
    bodyLines.push(`${indent}:raises ${r.type}: ${r.description}`);
  }

  if (bodyLines.length > 0) {
    lines.push("");
    lines.push(...bodyLines);
  }

  lines.push(`${indent}${quotes}`);
  return lines;
}
