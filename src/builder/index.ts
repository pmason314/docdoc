/**
 * Dispatch docstring building to the correct format module.
 */
import type { BuildConfig, Signature } from "../types.js";
import { buildGoogleSnippet, buildGoogleText } from "./google.js";
import { buildNumpySnippet, buildNumpyText } from "./numpy.js";
import { buildSphinxSnippet, buildSphinxText } from "./sphinx.js";

export function buildDocstringText(sig: Signature, indent: string, cfg: BuildConfig): string {
  switch (cfg.format) {
    case "numpy":
      return buildNumpyText(sig, indent, cfg);
    case "sphinx":
      return buildSphinxText(sig, indent, cfg);
    default:
      return buildGoogleText(sig, indent, cfg);
  }
}

export function buildDocstringSnippet(sig: Signature, indent: string, cfg: BuildConfig): string {
  switch (cfg.format) {
    case "numpy":
      return buildNumpySnippet(sig, indent, cfg);
    case "sphinx":
      return buildSphinxSnippet(sig, indent, cfg);
    default:
      return buildGoogleSnippet(sig, indent, cfg);
  }
}
