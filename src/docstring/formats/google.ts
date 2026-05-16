/**
 * Google-style docstring renderer.
 *
 * Section order: summary → extended summary → Args → Returns/Yields → Raises → Attributes
 *
 * Format reference:
 *   https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings
 */

import type { DocstringTarget, FunctionInfo, ClassInfo, Config } from "../../types.js";
import type { Renderer, RenderOptions } from "../renderer.js";
import { shouldEmitReturn, assembleSnippet, escT, tabStop, defaultsNote } from "./shared.js";

const INNER = "    "; // one extra indent level for section items

export class GoogleRenderer implements Renderer {
  render(target: DocstringTarget, config: Config, options: RenderOptions): string {
    const counter = { n: 1 };
    const lines: string[] = [];

    // -- Summary --
    lines.push(tabStop(counter, config.placeholders.summary));

    // -- Extended summary --
    if (config.includeExtendedSummary) {
      lines.push("");
      lines.push(tabStop(counter, config.placeholders.description || "Extended summary."));
    }

    if (target.kind === "function") {
      this._renderFunction(target, config, options, counter, lines);
    } else {
      this._renderClass(target, config, options, counter, lines);
    }

    return assembleSnippet(lines, config, options);
  }

  private _renderFunction(
    fn: FunctionInfo,
    config: Config,
    options: RenderOptions,
    counter: { n: number },
    lines: string[],
  ): void {
    const { raises = [] } = options;
    const params = fn.params;
    const returnKind = shouldEmitReturn(fn, config);

    // -- Args --
    if (params.length > 0) {
      lines.push("");
      lines.push("Args:");
      for (const p of params) {
        const typeStr =
          config.includeTypesFromAnnotations && p.annotation ? ` (${escT(p.annotation)})` : "";
        const note = defaultsNote(p, config);
        const ph = note
          ? tabStop(counter, note)
          : tabStop(counter, config.placeholders.description);
        const namePrefix =
          p.kind === "args" ? `*${p.name}` : p.kind === "kwargs" ? `**${p.name}` : p.name;
        lines.push(`${INNER}${escT(namePrefix)}${escT(typeStr)}: ${ph}`);
      }
    }

    // -- Returns / Yields --
    if (returnKind) {
      lines.push("");
      lines.push(returnKind === "yields" ? "Yields:" : "Returns:");
      const typeStr =
        config.includeTypesFromAnnotations && fn.returnAnnotation
          ? `${escT(fn.returnAnnotation)}: `
          : "";
      lines.push(`${INNER}${typeStr}${tabStop(counter, config.placeholders.description)}`);
    }

    // -- Raises --
    if (raises.length > 0) {
      lines.push("");
      lines.push("Raises:");
      for (const exc of raises) {
        lines.push(`${INNER}${escT(exc)}: ${tabStop(counter, config.placeholders.description)}`);
      }
    }
  }

  private _renderClass(
    cls: ClassInfo,
    config: Config,
    _options: RenderOptions,
    counter: { n: number },
    lines: string[],
  ): void {
    // -- Attributes --
    const attrs = config.includeClassAttributes && cls.attributes.length > 0 ? cls.attributes : [];
    if (attrs.length > 0) {
      lines.push("");
      lines.push("Attributes:");
      for (const attr of attrs) {
        const typeStr =
          config.includeTypesFromAnnotations && attr.annotation
            ? ` (${escT(attr.annotation)})`
            : "";
        lines.push(
          `${INNER}${escT(attr.name)}${escT(typeStr)}: ${tabStop(counter, config.placeholders.description)}`,
        );
      }
    }
  }
}
