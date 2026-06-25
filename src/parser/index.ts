/**
 * Public parser API.
 *
 * All heavy lifting lives in the sub-modules; this file is the single
 * import target for the extension layer and for integration tests.
 */
import { buildDocstringSnippet, buildDocstringText } from "../builder/index.js";
import { updateDocstring } from "../docstringParser/index.js";
import {
  extractAllSignatures,
  extractSignature,
  findDefNodeAtLine,
  getDocstringStmtNode,
  hasDocstring,
  hasModuleDocstring,
} from "./signatureParser.js";
import { initParser as _initParser, parseCode } from "./treeSitter.js";
import type { BuildConfig, DEFAULT_CONFIG, Insertion, Replacement, Signature } from "../types.js";
import { DEFAULT_CONFIG as _DEFAULT_CONFIG } from "../types.js";

// Re-export init for callers (extension + tests)
export { initParser } from "./treeSitter.js";
export type { Signature, Insertion, Replacement, BuildConfig };

// ---------------------------------------------------------------------------
// Helper: resolve partial config
// ---------------------------------------------------------------------------

function resolveConfig(cfg?: Partial<BuildConfig>): BuildConfig {
  return { ..._DEFAULT_CONFIG, ...cfg };
}

// ---------------------------------------------------------------------------
// Signature lookup (single symbol, for commands / trigger)
// ---------------------------------------------------------------------------

/**
 * Find the innermost function/class definition that contains or is nearest
 * to `lineNum` (0-based), and return its Signature.
 */
export function findSignatureAtLine(lines: string[], lineNum: number): Signature | null {
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return null;
  const found = findDefNodeAtLine(tree, lineNum);
  if (!found) return null;
  return extractSignature(found.def, found.decorated) ?? null;
}

// ---------------------------------------------------------------------------
// Generate (insert docstrings into file)
// ---------------------------------------------------------------------------

/**
 * Return an ordered list of insertions needed to add docstrings to all
 * undocumented functions/classes in the file.
 */
export function generateFileInsertions(
  lines: string[],
  config?: Partial<BuildConfig>,
): Insertion[] {
  const cfg = resolveConfig(config);
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return [];

  const insertions: Insertion[] = [];

  // Optional module-level docstring
  if (cfg.generateModuleDocstring && !hasModuleDocstring(tree)) {
    const moduleDocLine = findModuleDocInsertLine(lines);
    if (moduleDocLine !== null) {
      const q = cfg.quoteStyle === "single" ? "'''" : '"""';
      insertions.push({
        afterLine: moduleDocLine,
        lines: [`${q}${cfg.placeholderSummary}.${q}`, ""],
      });
    }
  }

  // All defs/classes
  const sigs = extractAllSignatures(tree);
  for (const sig of sigs) {
    // Re-fetch the def node to check docstring presence
    const found = findDefNodeAtLine(tree, sig.defLine);
    if (!found) continue;
    if (hasDocstring(found.def)) continue;

    const bodyIndent = lines[sig.bodyStartLine]?.match(/^(\s*)/)?.[1] ?? "";
    const docText = buildDocstringText(sig, bodyIndent, cfg);
    insertions.push({
      afterLine: sig.bodyStartLine - 1,
      lines: docText.split("\n"),
    });
  }

  return insertions;
}

/**
 * Apply a sorted list of insertions to a lines array.
 * Insertions must NOT overlap.
 */
export function applyInsertions(lines: string[], insertions: Insertion[]): string[] {
  const sorted = [...insertions].sort((a, b) => a.afterLine - b.afterLine);
  const result = [...lines];
  let offset = 0;
  for (const ins of sorted) {
    const at = ins.afterLine + 1 + offset;
    result.splice(at, 0, ...ins.lines);
    offset += ins.lines.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Update (sync existing docstrings with current signatures)
// ---------------------------------------------------------------------------

/**
 * Return replacements for every documented function/class in the file whose
 * docstring can be updated to match the current signature.
 */
export function getUpdateOperations(lines: string[], config?: Partial<BuildConfig>): Replacement[] {
  const cfg = resolveConfig(config);
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return [];
  const replacements: Replacement[] = [];

  const sigs = extractAllSignatures(tree);
  for (const sig of sigs) {
    // Use the actual indentation of the def line so descendantForPosition starts
    // inside the def/class node rather than in the surrounding scope.
    const defCol = (lines[sig.defLine] ?? "").match(/^(\s*)/)?.[1]?.length ?? 0;
    const found = findDefNodeAtLine(tree, sig.defLine, defCol);
    if (!found) continue;

    const stmtNode = getDocstringStmtNode(found.def);
    if (!stmtNode) continue; // no existing docstring

    const docStart = stmtNode.startPosition.row;
    const docEnd = stmtNode.endPosition.row;
    const docLines = lines.slice(docStart, docEnd + 1);

    const newLines = updateDocstring(docLines, docStart, sig, cfg);
    replacements.push({
      startLine: docStart,
      endLine: docEnd,
      newLines,
    });
  }

  return replacements;
}

/**
 * Apply replacements in reverse line order (so earlier line numbers stay valid).
 */
export function applyReplacements(lines: string[], replacements: Replacement[]): string[] {
  const sorted = [...replacements].sort((a, b) => b.startLine - a.startLine);
  const result = [...lines];
  for (const rep of sorted) {
    result.splice(rep.startLine, rep.endLine - rep.startLine + 1, ...rep.newLines);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Single-symbol helpers (for commands)
// ---------------------------------------------------------------------------

/**
 * Build the plain-text docstring for the symbol at `lineNum`.
 * Returns null if no signature is found or already documented.
 */
export function buildDocstringForLine(
  lines: string[],
  lineNum: number,
  config?: Partial<BuildConfig>,
): { docText: string; bodyIndent: string; afterLine: number } | null {
  const cfg = resolveConfig(config);
  const sig = findSignatureAtLine(lines, lineNum);
  if (!sig) return null;

  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return null;
  const found = findDefNodeAtLine(tree, sig.defLine);
  if (!found || hasDocstring(found.def)) return null;

  const bodyIndent = lines[sig.bodyStartLine]?.match(/^(\s*)/)?.[1] ?? "";
  const docText = buildDocstringText(sig, bodyIndent, cfg);
  return { docText, bodyIndent, afterLine: sig.bodyStartLine - 1 };
}

/**
 * Build a VS Code snippet docstring for the symbol at `lineNum`.
 * Returns null if no signature found.
 */
export function buildSnippetForLine(
  lines: string[],
  lineNum: number,
  config?: Partial<BuildConfig>,
): { snippet: string; afterLine: number } | null {
  const cfg = resolveConfig(config);
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return null;

  const found = findDefNodeAtLine(tree, lineNum);
  if (!found) return null;

  // Suppress if the function already has a complete docstring.
  if (hasDocstring(found.def)) return null;

  const sig = extractSignature(found.def, found.decorated);
  if (!sig) return null;

  const bodyIndent = lines[sig.bodyStartLine]?.match(/^(\s*)/)?.[1] ?? "";
  const snippet = buildDocstringSnippet(sig, bodyIndent, cfg);
  return { snippet, afterLine: sig.bodyStartLine - 1 };
}

/**
 * Build the updated docstring text for the symbol at `lineNum`.
 * Returns null if not found or no existing docstring.
 */
export function buildUpdateForLine(
  lines: string[],
  lineNum: number,
  config?: Partial<BuildConfig>,
): Replacement | null {
  const cfg = resolveConfig(config);
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return null;

  const found = findDefNodeAtLine(tree, lineNum);
  if (!found) return null;

  const stmtNode = getDocstringStmtNode(found.def);
  if (!stmtNode) return null;

  const sig = extractSignature(found.def, found.decorated);
  if (!sig) return null;

  const docStart = stmtNode.startPosition.row;
  const docEnd = stmtNode.endPosition.row;
  const docLines = lines.slice(docStart, docEnd + 1);

  const newLines = updateDocstring(docLines, docStart, sig, cfg);
  return { startLine: docStart, endLine: docEnd, newLines };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Find the line after which to insert a module-level docstring. */
function findModuleDocInsertLine(lines: string[]): number | null {
  let lastHeaderLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      lastHeaderLine = i;
    } else {
      break;
    }
  }
  // Insert right after all leading comments / blank lines
  // (or at line -1 meaning before any content, which we handle as line 0 in applyInsertions)
  return lastHeaderLine;
}
