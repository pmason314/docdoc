/**
 * Build Google-style docstring lines from a Signature + config.
 *
 * Two outputs:
 *   buildGoogleText   — plain text (for commands)
 *   buildGoogleSnippet — VS Code snippet with tab stops (for inline trigger)
 */
import type { BuildConfig, Param, Signature } from "../types.js";

// ---------------------------------------------------------------------------
// Plain-text builder
// ---------------------------------------------------------------------------

export function buildGoogleText(sig: Signature, indent: string, cfg: BuildConfig): string {
  return buildGoogleLines(sig, indent, cfg, false).join("\n");
}

export function buildGoogleSnippet(sig: Signature, indent: string, cfg: BuildConfig): string {
  return buildGoogleLines(sig, indent, cfg, true).join("\n");
}

// ---------------------------------------------------------------------------
// Shared line builder
// ---------------------------------------------------------------------------

function buildGoogleLines(
  sig: Signature,
  indent: string,
  cfg: BuildConfig,
  snippet: boolean,
): string[] {
  const q = cfg.quoteStyle === "single" ? "'''" : '"""';
  let tabStop = 1;
  const ph = (text: string) => (snippet ? `\${${tabStop++}:${text}}` : text);

  // Classes: single-line summary only
  if (sig.kind === "class") {
    return [`${indent}${q}${ph(cfg.placeholderSummary)}.${q}`];
  }

  // Determine sections
  const argLines = buildArgsLines(sig.params, indent, cfg, ph);
  const retLines = buildReturnsLines(sig, indent, cfg, ph);
  const raisesLines = buildRaisesLines(sig.raises, indent, cfg, ph);

  const sections = [argLines, retLines, raisesLines].filter((s) => s.length > 0);

  const lines: string[] = [];
  lines.push(`${indent}${q}${ph(cfg.placeholderSummary)}.`);

  for (const section of sections) {
    lines.push(""); // blank line before each section
    lines.push(...section);
  }

  lines.push(`${indent}${q}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildArgsLines(
  params: Param[],
  indent: string,
  cfg: BuildConfig,
  ph: (text: string) => string,
): string[] {
  if (params.length === 0) return [];

  const lines = [`${indent}Args:`];
  for (const param of params) {
    const displayName =
      param.kind === "var_positional"
        ? `*${param.name}`
        : param.kind === "var_keyword"
          ? `**${param.name}`
          : param.name;

    const typePart = cfg.includeTypes && param.type ? ` (${param.type})` : "";

    let desc = ph(cfg.placeholderDescription);
    if (cfg.includeDefaults && param.default !== undefined) {
      desc += `. Defaults to ${param.default}.`;
    }

    lines.push(`${indent}    ${displayName}${typePart}: ${desc}`);
  }
  return lines;
}

function buildReturnsLines(
  sig: Signature,
  indent: string,
  cfg: BuildConfig,
  ph: (text: string) => string,
): string[] {
  if (cfg.returnsMode === "non-none" && sig.returnType === "None") return [];

  const header = sig.isGenerator ? `${indent}Yields:` : `${indent}Returns:`;
  const typePart = sig.returnType ? `${sig.returnType}: ` : "";
  return [header, `${indent}    ${typePart}${ph(cfg.placeholderDescription)}`];
}

function buildRaisesLines(
  raises: string[],
  indent: string,
  cfg: BuildConfig,
  ph: (text: string) => string,
): string[] {
  if (raises.length === 0) return [];
  const lines = [`${indent}Raises:`];
  for (const exc of raises) {
    lines.push(`${indent}    ${exc}: ${ph(cfg.placeholderDescription)}`);
  }
  return lines;
}
