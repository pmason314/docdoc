/**
 * Build Sphinx / reStructuredText-style docstring lines from a Signature + config.
 */
import type { BuildConfig, Param, Signature } from "../types.js";

export function buildSphinxText(sig: Signature, indent: string, cfg: BuildConfig): string {
  return buildSphinxLines(sig, indent, cfg, false).join("\n");
}

export function buildSphinxSnippet(sig: Signature, indent: string, cfg: BuildConfig): string {
  return buildSphinxLines(sig, indent, cfg, true).join("\n");
}

function buildSphinxLines(
  sig: Signature,
  indent: string,
  cfg: BuildConfig,
  snippet: boolean,
): string[] {
  const q = cfg.quoteStyle === "single" ? "'''" : '"""';
  let tabStop = 1;
  const ph = (text: string) => (snippet ? `\${${tabStop++}:${text}}` : text);

  if (sig.kind === "class") {
    return [`${indent}${q}${ph(cfg.placeholderSummary)}.${q}`];
  }

  const summaryPh = ph(cfg.placeholderSummary);
  const body = buildSphinxBody(sig, indent, cfg, ph);
  if (body.length === 0) {
    return [`${indent}${q}${summaryPh}.${q}`];
  }

  const lines: string[] = [];
  lines.push(`${indent}${q}${summaryPh}.`);
  lines.push("");
  lines.push(...body);

  lines.push(`${indent}${q}`);
  return lines;
}

function buildSphinxBody(
  sig: Signature,
  indent: string,
  cfg: BuildConfig,
  ph: (text: string) => string,
): string[] {
  const lines: string[] = [];

  for (const param of sig.params) {
    const displayName =
      param.kind === "var_positional"
        ? `*${param.name}`
        : param.kind === "var_keyword"
          ? `**${param.name}`
          : param.name;

    let desc = ph(cfg.placeholderDescription);
    if (cfg.includeDefaults && param.default !== undefined) {
      desc += ` Defaults to ${param.default}.`;
    }

    lines.push(`${indent}:param ${displayName}: ${desc}`);
    if (cfg.includeTypes && param.type) {
      lines.push(`${indent}:type ${displayName}: ${param.type}`);
    }
  }

  if (sig.params.length > 0 && (sig.returnType || sig.raises.length > 0)) {
    lines.push("");
  }

  const includeReturns =
    cfg.returnsMode === "always" ||
    (cfg.returnsMode === "auto" &&
      (sig.hasReturnValue ||
        sig.isGenerator ||
        (sig.returnType !== undefined && sig.returnType !== "None")));

  if (includeReturns) {
    const retLabel = sig.isGenerator ? "yields" : "returns";
    lines.push(`${indent}:${retLabel}: ${ph(cfg.placeholderDescription)}`);
    if (sig.returnType) {
      const rtypeLabel = sig.isGenerator ? "ytype" : "rtype";
      lines.push(`${indent}:${rtypeLabel}: ${sig.returnType}`);
    }
  }

  for (const exc of sig.raises) {
    lines.push(`${indent}:raises ${exc}: ${ph(cfg.placeholderDescription)}`);
  }

  return lines;
}
