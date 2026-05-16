/**
 * Singleton WASM-backed tree-sitter parser for Python.
 *
 * Call setWasmDir() before the first getParser() when running in a bundled
 * VS Code extension (so the loader finds the .wasm files in dist/).
 * In tests the loader falls back to resolving from node_modules automatically.
 */

import { readFile } from "fs/promises";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// web-tree-sitter uses a CJS/UMD build; import its named exports.
import { Parser, Language } from "web-tree-sitter";

const _require = createRequire(import.meta.url);
const _moduleDir = dirname(fileURLToPath(import.meta.url));

let _wasmDir: string | null = null;
let _parserPromise: Promise<{ parser: Parser; language: Language }> | null = null;

/**
 * Override the directory from which WASM files are loaded.
 * Must be called before the first getParser() invocation in a bundled context.
 * Calling this after initialisation resets the singleton.
 */
export function setWasmDir(dir: string): void {
  _wasmDir = dir;
  _parserPromise = null;
}

/** Resolve the path to a bundled WASM file by its base name (no extension). */
function resolveWasmPath(basename: string): string {
  if (_wasmDir) {
    return join(_wasmDir, `${basename}.wasm`);
  }
  // Dev / test: load directly from node_modules
  try {
    return _require.resolve(`${basename}/${basename}.wasm`);
  } catch {
    // Last resort: assume WASM is next to this file (shouldn't happen in practice)
    return join(_moduleDir, `${basename}.wasm`);
  }
}

async function _init(): Promise<{ parser: Parser; language: Language }> {
  const mainWasmPath = resolveWasmPath("web-tree-sitter");
  const pythonWasmPath = resolveWasmPath("tree-sitter-python");
  await Parser.init({ wasmBinary: await readFile(mainWasmPath) });
  const language = await Language.load(pythonWasmPath);
  const parser = new Parser();
  parser.setLanguage(language);
  return { parser, language };
}

/** Return the cached (or freshly initialised) parser + language pair. */
export function getParser(): Promise<{ parser: Parser; language: Language }> {
  if (!_parserPromise) {
    _parserPromise = _init();
  }
  return _parserPromise;
}
