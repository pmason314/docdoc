/**
 * Extract Python function/class signatures from a tree-sitter AST.
 *
 * Node types used (tree-sitter-python 0.25.x):
 *   decorated_definition, function_definition, class_definition,
 *   parameters, identifier, typed_parameter, default_parameter,
 *   typed_default_parameter, list_splat_pattern, dictionary_splat_pattern,
 *   keyword_separator, positional_separator,
 *   raise_statement, yield (expression), yield_from (expression),
 *   expression_statement, string, block
 */
import type Parser from "web-tree-sitter";
import type { Node as SyntaxNode, Tree } from "web-tree-sitter";
import type { Param, ParamKind, Signature } from "../types.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Collect all function/class signatures from a parsed tree (DFS, nested included). */
export function extractAllSignatures(tree: Tree): Signature[] {
  const sigs: Signature[] = [];
  visitNode(tree.rootNode, sigs);
  return sigs;
}

/**
 * Find the innermost function_definition or class_definition node that
 * contains `line` (0-based), walking upward from that position.
 *
 * `column` defaults to 0 but callers that know the indentation of the def line
 * should pass it so `descendantForPosition` starts inside the node rather than
 * in the surrounding scope (which would walk up to the wrong parent).
 */
export function findDefNodeAtLine(
  tree: Tree,
  line: number,
  column = 0,
): { def: SyntaxNode; decorated?: SyntaxNode } | null {
  // Start from the node at the given line/column and walk up.
  let node: SyntaxNode | null = tree.rootNode.descendantForPosition({
    row: line,
    column,
  });

  while (node) {
    if (node.type === "function_definition" || node.type === "class_definition") {
      const parent = node.parent;
      const decorated = parent?.type === "decorated_definition" ? parent : undefined;
      return { def: node, decorated };
    }
    node = node.parent;
  }
  return null;
}

/** Return a Signature for the def/class node (+ optional decorated wrapper). */
export function extractSignature(
  defNode: SyntaxNode,
  decoratedNode?: SyntaxNode,
): Signature | null {
  const isFunction = defNode.type === "function_definition";
  const isClass = defNode.type === "class_definition";
  if (!isFunction && !isClass) return null;

  const nameNode = defNode.childForFieldName("name");
  if (!nameNode) return null;

  const startLine = (decoratedNode ?? defNode).startPosition.row;
  const defLine = defNode.startPosition.row;

  const bodyNode = defNode.childForFieldName("body");
  if (!bodyNode) return null;
  const bodyStartLine = bodyNode.startPosition.row;
  const bodyEndLine = bodyNode.endPosition.row;

  let params: Param[] = [];
  let isAsync = false;
  let returnType: string | undefined;
  let isGenerator = false;
  let raises: string[] = [];

  if (isFunction) {
    isAsync = defNode.children.some((c) => c.type === "async");

    const paramsNode = defNode.childForFieldName("parameters");
    if (paramsNode) params = extractParams(paramsNode);

    const retNode = defNode.childForFieldName("return_type");
    if (retNode) returnType = retNode.text;

    isGenerator = detectGenerator(bodyNode);
    raises = detectRaises(bodyNode);
  }

  const decorators: string[] = [];
  if (decoratedNode) {
    for (const child of decoratedNode.children) {
      if (child.type === "decorator") {
        // Strip the leading '@'
        decorators.push(child.text.slice(1).trim());
      }
    }
  }

  return {
    kind: isFunction ? "function" : "class",
    name: nameNode.text,
    params,
    returnType,
    isAsync,
    isGenerator,
    raises,
    decorators,
    startLine,
    defLine,
    bodyStartLine,
    bodyEndLine,
  };
}

// ---------------------------------------------------------------------------
// Docstring presence
// ---------------------------------------------------------------------------

/** True if the body's first non-comment statement is a string literal. */
export function hasDocstring(defNode: SyntaxNode): boolean {
  return getDocstringStmtNode(defNode) !== null;
}

/**
 * Return the expression_statement node holding the docstring,
 * or null if none.
 */
export function getDocstringStmtNode(defNode: SyntaxNode): SyntaxNode | null {
  const bodyNode = defNode.childForFieldName("body");
  if (!bodyNode) return null;

  for (const child of bodyNode.children) {
    if (!child.isNamed) continue;
    if (child.type !== "expression_statement") break;
    const expr = child.children.find((c) => c.isNamed);
    if (expr?.type === "string") return child;
    break;
  }
  return null;
}

/** True if the module's first statement is a string literal. */
export function hasModuleDocstring(tree: Tree): boolean {
  for (const child of tree.rootNode.children) {
    if (!child.isNamed || child.type === "comment") continue;
    if (child.type !== "expression_statement") return false;
    const expr = child.children.find((c) => c.isNamed);
    return expr?.type === "string";
  }
  return false;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** DFS walker that collects signatures. Recurses into body of each def/class. */
function visitNode(node: SyntaxNode, sigs: Signature[]): void {
  if (node.type === "decorated_definition") {
    const defNode = node.childForFieldName("definition");
    if (
      defNode &&
      (defNode.type === "function_definition" || defNode.type === "class_definition")
    ) {
      const sig = extractSignature(defNode, node);
      if (sig) sigs.push(sig);
      // Recurse into body
      const body = defNode.childForFieldName("body");
      if (body) {
        for (const child of body.children) visitNode(child, sigs);
      }
    }
    return;
  }

  if (node.type === "function_definition" || node.type === "class_definition") {
    const sig = extractSignature(node);
    if (sig) sigs.push(sig);
    const body = node.childForFieldName("body");
    if (body) {
      for (const child of body.children) visitNode(child, sigs);
    }
    return;
  }

  for (const child of node.children) visitNode(child, sigs);
}

function extractParams(paramsNode: SyntaxNode): Param[] {
  const params: Param[] = [];
  let afterStar = false; // true once we've seen * or *args

  for (const child of paramsNode.children) {
    switch (child.type) {
      case "identifier": {
        const name = child.text;
        if (name === "self" || name === "cls") break;
        params.push({ name, kind: afterStar ? "keyword_only" : "regular" });
        break;
      }

      case "typed_parameter": {
        const name = child.children.find((c) => c.type === "identifier")?.text;
        if (!name || name === "self" || name === "cls") break;
        const typeText = child.children.find((c) => c.type === "type")?.text;
        params.push({
          name,
          type: typeText,
          kind: afterStar ? "keyword_only" : "regular",
        });
        break;
      }

      case "default_parameter": {
        const name = child.childForFieldName("name")?.text;
        if (!name || name === "self" || name === "cls") break;
        const defaultVal = child.childForFieldName("value")?.text;
        params.push({
          name,
          default: defaultVal,
          kind: afterStar ? "keyword_only" : "regular",
        });
        break;
      }

      case "typed_default_parameter": {
        const name = child.childForFieldName("name")?.text;
        if (!name || name === "self" || name === "cls") break;
        const typeText = child.childForFieldName("type")?.text;
        const defaultVal = child.childForFieldName("value")?.text;
        params.push({
          name,
          type: typeText,
          default: defaultVal,
          kind: afterStar ? "keyword_only" : "regular",
        });
        break;
      }

      case "list_splat_pattern": {
        // *args — or bare * handled by keyword_separator
        const ident = child.children.find((c) => c.type === "identifier");
        if (ident) {
          params.push({ name: ident.text, kind: "var_positional" });
        }
        afterStar = true;
        break;
      }

      case "keyword_separator": {
        // Bare `*` — marks subsequent params as keyword-only
        afterStar = true;
        break;
      }

      case "positional_separator": {
        // `/` — mark preceding params as positional-only
        for (const p of params) {
          (p as { kind: ParamKind }).kind = "positional_only";
        }
        break;
      }

      case "dictionary_splat_pattern": {
        const ident = child.children.find((c) => c.type === "identifier");
        if (ident) {
          params.push({ name: ident.text, kind: "var_keyword" });
        }
        break;
      }
    }
  }

  return params;
}

/** True if the body contains a yield/yield-from outside nested defs. */
function detectGenerator(bodyNode: SyntaxNode): boolean {
  function search(node: SyntaxNode): boolean {
    if (node.type === "function_definition" || node.type === "class_definition") {
      return false;
    }
    if (node.type === "yield" || node.type === "yield_from") return true;
    return node.children.some((c) => search(c));
  }
  return search(bodyNode);
}

/**
 * Collect exception names from raise statements in the body.
 * Skips nested defs, bare `raise`, and names that start with lowercase.
 */
function detectRaises(bodyNode: SyntaxNode): string[] {
  const seen = new Set<string>();
  const order: string[] = [];

  function search(node: SyntaxNode): void {
    if (node.type === "function_definition" || node.type === "class_definition") {
      return;
    }
    if (node.type === "raise_statement") {
      // Children: 'raise' token + optional expression
      const expr = node.children.find((c) => c.isNamed && c.type !== "raise");
      if (expr) {
        const name = resolveExceptionName(expr);
        if (name && /^[A-Z]/.test(name) && !seen.has(name)) {
          seen.add(name);
          order.push(name);
        }
      }
      return;
    }
    node.children.forEach((c) => search(c));
  }

  search(bodyNode);
  return order;
}

function resolveExceptionName(node: SyntaxNode): string | null {
  if (node.type === "identifier") return node.text;
  if (node.type === "call") {
    const fn = node.childForFieldName("function");
    return fn ? resolveExceptionName(fn) : null;
  }
  if (node.type === "attribute") {
    // e.g. module.MyError — use just the attribute part
    const attr = node.childForFieldName("attribute");
    return attr ? attr.text : null;
  }
  return null;
}
