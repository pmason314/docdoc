/**
 * NumPy-style docstring renderer.
 *
 * Section order: summary → extended summary → Parameters → Returns/Yields → Raises → Attributes
 *
 * Format reference:
 *   https://numpydoc.readthedocs.io/en/latest/format.html
 */

import type { DocstringTarget, FunctionInfo, ClassInfo, Config } from "../../types.js";
import type { Renderer, RenderOptions } from "../renderer.js";
import { shouldEmitReturn, assembleSnippet, escT, tabStop, defaultsNote } from "./shared.js";

const INNER = "    "; // one indent level for content under section headers

function underline(header: string): string {
  return "-".repeat(header.length);
}

export class NumpyRenderer implements Renderer {
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

    // -- Parameters --
    if (params.length > 0) {
      lines.push("");
      lines.push("Parameters");
      lines.push(underline("Parameters"));
      for (const p of params) {
        const namePrefix =
          p.kind === "args" ? `*${p.name}` : p.kind === "kwargs" ? `**${p.name}` : p.name;
        if (config.includeTypesFromAnnotations && p.annotation) {
          const optional =
            p.isOptional || p.kind === "args" || p.kind === "kwargs" ? ", optional" : "";
          lines.push(`${escT(namePrefix)} : ${escT(p.annotation)}${escT(optional)}`);
        } else {
          lines.push(`${escT(namePrefix)}`);
        }
        const note = defaultsNote(p, config);
        const ph = note
          ? tabStop(counter, `by default ${escT(p.default ?? "")}`)
          : tabStop(counter, config.placeholders.description);
        lines.push(`${INNER}${ph}`);
      }
    }

    // -- Returns / Yields --
    if (returnKind) {
      const header = returnKind === "yields" ? "Yields" : "Returns";
      lines.push("");
      lines.push(header);
      lines.push(underline(header));
      if (config.includeTypesFromAnnotations && fn.returnAnnotation) {
        lines.push(escT(fn.returnAnnotation));
      }
      lines.push(`${INNER}${tabStop(counter, config.placeholders.description)}`);
    }

    // -- Raises --
    if (raises.length > 0) {
      lines.push("");
      lines.push("Raises");
      lines.push(underline("Raises"));
      for (const exc of raises) {
        lines.push(escT(exc));
        lines.push(`${INNER}${tabStop(counter, config.placeholders.description)}`);
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
      lines.push("Attributes");
      lines.push(underline("Attributes"));
      for (const attr of attrs) {
        if (config.includeTypesFromAnnotations && attr.annotation) {
          lines.push(`${escT(attr.name)} : ${escT(attr.annotation)}`);
        } else {
          lines.push(escT(attr.name));
        }
        lines.push(`${INNER}${tabStop(counter, config.placeholders.description)}`);
      }
    }
  }
}
