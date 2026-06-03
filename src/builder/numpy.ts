/**
 * Build NumPy-style docstring lines from a Signature + config.
 */
import type { BuildConfig, Param, Signature } from "../types.js";

export function buildNumpyText(sig: Signature, indent: string, cfg: BuildConfig): string {
  return buildNumpyLines(sig, indent, cfg, false).join("\n");
}

export function buildNumpySnippet(sig: Signature, indent: string, cfg: BuildConfig): string {
  return buildNumpyLines(sig, indent, cfg, true).join("\n");
}

function buildNumpyLines(
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

  const argLines = buildParamsLines(sig.params, indent, cfg, ph);
  const retLines = buildReturnsLines(sig, indent, cfg, ph);
  const raisesLines = buildRaisesLines(sig.raises, indent, cfg, ph);

  const sections = [argLines, retLines, raisesLines].filter((s) => s.length > 0);

  const lines: string[] = [];
  lines.push(`${indent}${q}${ph(cfg.placeholderSummary)}.`);

  for (const section of sections) {
    lines.push("");
    lines.push(...section);
  }

  lines.push(`${indent}${q}`);
  return lines;
}

function buildParamsLines(
  params: Param[],
  indent: string,
  cfg: BuildConfig,
  ph: (text: string) => string,
): string[] {
  if (params.length === 0) return [];

  const dashes = `${indent}----------`;
  const lines = [`${indent}Parameters`, dashes];

  for (const param of params) {
    const displayName =
      param.kind === "var_positional"
        ? `*${param.name}`
        : param.kind === "var_keyword"
          ? `**${param.name}`
          : param.name;

    const typePart = cfg.includeTypes && param.type ? ` : ${param.type}` : "";

    let desc = ph(cfg.placeholderDescription);
    if (cfg.includeDefaults && param.default !== undefined) {
      desc += ` Defaults to ${param.default}.`;
    }

    lines.push(`${indent}${displayName}${typePart}`);
    lines.push(`${indent}    ${desc}`);
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

  const header = sig.isGenerator ? "Yields" : "Returns";
  const dashes = "-".repeat(header.length);
  const typeLine = sig.returnType ?? "";
  return [
    `${indent}${header}`,
    `${indent}${dashes}`,
    ...(typeLine ? [`${indent}${typeLine}`] : []),
    `${indent}    ${ph(cfg.placeholderDescription)}`,
  ];
}

function buildRaisesLines(
  raises: string[],
  indent: string,
  cfg: BuildConfig,
  ph: (text: string) => string,
): string[] {
  if (raises.length === 0) return [];
  const lines = [`${indent}Raises`, `${indent}------`];
  for (const exc of raises) {
    lines.push(`${indent}${exc}`);
    lines.push(`${indent}    ${ph(cfg.placeholderDescription)}`);
  }
  return lines;
}
