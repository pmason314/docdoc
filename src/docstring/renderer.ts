/**
 * Renderer interface and factory.
 *
 * All renderers are pure functions — no VS Code API, no async I/O.
 * The caller (Phase 5) is responsible for supplying indentation and quote style.
 */

import type { DocstringTarget, DocstringFormat, Config } from "../types.js";
import { GoogleRenderer } from "./formats/google.js";
import { NumpyRenderer } from "./formats/numpy.js";
import { SphinxRenderer } from "./formats/sphinx.js";

export interface RenderOptions {
  /** Indentation string for the docstring body (one indent level from def/class). */
  indent: string;
  /** Opening/closing quote delimiter: `'"""'` or `"'''"`. */
  quoteChar: string;
  /**
   * Exception type names detected by the subprocess (Phase 7).
   * Defaults to [] — no Raises section is emitted until Phase 7 populates this.
   */
  raises?: string[];
}

export interface Renderer {
  render(target: DocstringTarget, config: Config, options: RenderOptions): string;
}

/** Return the correct renderer for the given docstring format. */
export function getRenderer(format: DocstringFormat): Renderer {
  switch (format) {
    case "google":
      return new GoogleRenderer();
    case "numpy":
      return new NumpyRenderer();
    case "sphinx":
      return new SphinxRenderer();
  }
}
