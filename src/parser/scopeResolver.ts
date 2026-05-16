/**
 * Resolves the docstring target (function, class, or module-level) at a given
 * cursor position within a Python source text.
 *
 * No VS Code API dependencies. Accepts a pre-initialised Parser instance so
 * the caller controls WASM loading.
 */

import type { Parser } from "web-tree-sitter";
import type { Node } from "web-tree-sitter";
import type { DocstringTarget, FunctionInfo } from "../types.js";
import { extractFunctionInfo, extractClassInfo } from "./signatureExtractor.js";

type SyntaxNode = Node;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDecorators(decoratedNode: SyntaxNode): string[] {
  if (decoratedNode.type !== "decorated_definition") return [];
  return decoratedNode.namedChildren.filter((c) => c.type === "decorator").map((c) => c.text);
}

function isOverload(decorators: string[]): boolean {
  return decorators.some((d) => d === "@typing.overload" || d === "@overload");
}

function extractModuleDocstring(root: SyntaxNode): string | null {
  const first = root.namedChildren[0];
  if (!first || first.type !== "expression_statement") return null;
  const expr = first.namedChildren[0];
  if (!expr || expr.type !== "string") return null;
  return expr.text;
}

function buildModuleTarget(root: SyntaxNode, source: string): FunctionInfo {
  const lines = source.split("\n");
  const lastLine = Math.max(0, lines.length - 1);
  return {
    kind: "function",
    name: "__module__",
    params: [],
    returnAnnotation: null,
    decorators: [],
    isAsync: false,
    isGenerator: false,
    typeParams: [],
    docstring: extractModuleDocstring(root),
    bodyRange: { startLine: 0, startCol: 0, endLine: lastLine, endCol: 0 },
    signatureRange: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
    scopeLevel: "module",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the nearest function or class that encloses the given cursor
 * position, or return a module-level target if the cursor is at the top level.
 *
 * Functions decorated with `@typing.overload` (or bare `@overload`) are
 * skipped — the docstring should be placed on the implementation signature.
 *
 * @param source          Full Python source text.
 * @param line            Zero-based line index of the cursor.
 * @param col             Zero-based column index of the cursor.
 * @param parser          An initialised tree-sitter Parser with Python language set.
 * @param mergeInitParams When true, `__init__` params are hoisted into ClassInfo.
 * @returns               The resolved target, or null if the source is empty.
 */
export function resolveTarget(
  source: string,
  line: number,
  col: number,
  parser: Parser,
  mergeInitParams = false,
): DocstringTarget | null {
  if (!source.trim()) return null;

  const tree = parser.parse(source);
  if (!tree) return null;
  const root = tree.rootNode;
  const nodeAtPos = root.descendantForPosition({ row: line, column: col });
  if (!nodeAtPos) return buildModuleTarget(root, source);

  // Walk upward to find the nearest function_definition or class_definition
  let node: SyntaxNode | null = nodeAtPos;
  while (node && node.type !== "module") {
    if (node.type === "function_definition") {
      const decoratorParent = node.parent?.type === "decorated_definition" ? node.parent : null;
      const decorators = decoratorParent ? extractDecorators(decoratorParent) : [];
      if (isOverload(decorators)) {
        node = node.parent;
        continue;
      }
      return extractFunctionInfo(node, decorators);
    }

    if (node.type === "class_definition") {
      const decoratorParent = node.parent?.type === "decorated_definition" ? node.parent : null;
      const decorators = decoratorParent ? extractDecorators(decoratorParent) : [];
      return extractClassInfo(node, decorators, mergeInitParams);
    }

    if (node.type === "decorated_definition") {
      const inner = node.namedChildren.find(
        (c) => c.type === "function_definition" || c.type === "class_definition",
      );
      if (!inner) {
        node = node.parent;
        continue;
      }
      const decorators = extractDecorators(node);
      if (inner.type === "function_definition") {
        if (isOverload(decorators)) {
          node = node.parent;
          continue;
        }
        return extractFunctionInfo(inner, decorators);
      }
      return extractClassInfo(inner, decorators, mergeInitParams);
    }

    node = node.parent;
  }

  // Fell off the top — module level
  return buildModuleTarget(root, source);
}
