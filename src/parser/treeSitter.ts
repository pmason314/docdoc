/**
 * Tree-sitter singleton: initialise once, then parse and cache Python ASTs.
 *
 * Works in two contexts:
 *   - Bundled VS Code extension (out/): WASMs are copied next to extension.js
 *   - Development / mocha tests (tsx):  WASMs are in node_modules
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { Parser, Language } from "web-tree-sitter";

let parser: InstanceType<typeof Parser> | null = null;

function resolveWasm(filename: string, packageName: string): string {
  // 1. Same directory as this file (bundled extension after esbuild copy).
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const localPath = join(moduleDir, filename);
  if (existsSync(localPath)) return localPath;

  // 2. Direct node_modules path (dev / test context).
  const nodeModulesPath = resolve(moduleDir, "../../../node_modules", packageName, filename);
  if (existsSync(nodeModulesPath)) return nodeModulesPath;

  // 3. Alternative: check common locations
  for (const basePath of [
    resolve(moduleDir, "../../.."), // From src/parser/
    process.cwd(),
  ]) {
    const candidate = join(basePath, "node_modules", packageName, filename);
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(`Cannot find ${filename}. Searched: ${localPath}, ${nodeModulesPath}`);
}

export async function initParser(): Promise<void> {
  if (parser !== null) return;

  const webTSWasm = resolveWasm("web-tree-sitter.wasm", "web-tree-sitter");
  const pythonWasm = resolveWasm("tree-sitter-python.wasm", "tree-sitter-python");

  // Initialize tree-sitter with custom WASM file location
  await Parser.init({ wasmBinary: readFileSync(webTSWasm) });

  // Load Python language
  const Python = await Language.load(pythonWasm);
  parser = new Parser();
  parser.setLanguage(Python);
}

export function getParser(): InstanceType<typeof Parser> {
  if (!parser) {
    throw new Error("Tree-sitter parser not initialised. Call initParser() first.");
  }
  return parser;
}

export function parseCode(code: string) {
  return getParser().parse(code);
}
