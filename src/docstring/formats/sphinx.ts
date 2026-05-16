/**
 * Sphinx / reStructuredText docstring renderer.
 *
 * Format reference:
 *   https://www.sphinx-doc.org/en/master/usage/domains/python.html
 */

import type { DocstringTarget, FunctionInfo, ClassInfo, Config } from "../../types.js";
import type { Renderer, RenderOptions } from "../renderer.js";
import { shouldEmitReturn, assembleSnippet, escT, tabStop } from "./shared.js";

export class SphinxRenderer implements Renderer {
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

    // -- Params --
    if (params.length > 0) {
      lines.push("");
      for (const p of params) {
        const namePrefix =
          p.kind === "args" ? `*${p.name}` : p.kind === "kwargs" ? `**${p.name}` : p.name;
        lines.push(
          `:param ${escT(namePrefix)}: ${tabStop(counter, config.placeholders.description)}`,
        );
        if (config.includeTypesFromAnnotations && p.annotation) {
          lines.push(`:type ${escT(namePrefix)}: ${escT(p.annotation)}`);
        }
      }
    }

    // -- Returns / Yields --
    if (returnKind) {
      if (lines[lines.length - 1] !== "") lines.push("");
      if (returnKind === "yields") {
        lines.push(`:yields: ${tabStop(counter, config.placeholders.description)}`);
      } else {
        lines.push(`:returns: ${tabStop(counter, config.placeholders.description)}`);
      }
      if (config.includeTypesFromAnnotations && fn.returnAnnotation) {
        lines.push(`:rtype: ${escT(fn.returnAnnotation)}`);
      }
    }

    // -- Raises --
    if (raises.length > 0) {
      if (lines[lines.length - 1] !== "") lines.push("");
      for (const exc of raises) {
        lines.push(`:raises ${escT(exc)}: ${tabStop(counter, config.placeholders.description)}`);
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
    // Sphinx doesn't have a dedicated Attributes section; use :var directives
    const attrs = config.includeClassAttributes && cls.attributes.length > 0 ? cls.attributes : [];
    if (attrs.length > 0) {
      lines.push("");
      for (const attr of attrs) {
        lines.push(`:var ${escT(attr.name)}: ${tabStop(counter, config.placeholders.description)}`);
        if (config.includeTypesFromAnnotations && attr.annotation) {
          lines.push(`:vartype ${escT(attr.name)}: ${escT(attr.annotation)}`);
        }
      }
    }
  }
}
