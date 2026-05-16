/**
 * Extracts FunctionInfo and ClassInfo from tree-sitter SyntaxNode objects.
 * No VS Code API dependencies. No async I/O — all operations are pure tree walks.
 */

import type { Node } from "web-tree-sitter";
import type {
  FunctionInfo,
  ClassInfo,
  Param,
  TypeParam,
  ClassAttribute,
  SourceRange,
} from "../types.js";

type SyntaxNode = Node;

// ---------------------------------------------------------------------------
// Range helpers
// ---------------------------------------------------------------------------

function nodeRange(node: SyntaxNode): SourceRange {
  return {
    startLine: node.startPosition.row,
    startCol: node.startPosition.column,
    endLine: node.endPosition.row,
    endCol: node.endPosition.column,
  };
}

// ---------------------------------------------------------------------------
// Existing docstring
// ---------------------------------------------------------------------------

function extractExistingDocstring(bodyNode: SyntaxNode): string | null {
  const first = bodyNode.namedChildren[0];
  if (!first || first.type !== "expression_statement") return null;
  const expr = first.namedChildren[0];
  if (!expr || expr.type !== "string") return null;
  return expr.text;
}

// ---------------------------------------------------------------------------
// PEP 695 type parameters: def f[T, *Ts, **P, S: str]()
// ---------------------------------------------------------------------------

function extractTypeParams(tpsNode: SyntaxNode | null): TypeParam[] {
  if (!tpsNode) return [];
  const result: TypeParam[] = [];
  for (const child of tpsNode.namedChildren) {
    // Each named child is a "type" node wrapping the actual type param construct
    const inner = child.namedChildren[0];
    if (!inner) continue;

    if (inner.type === "identifier") {
      // Plain TypeVar: T
      result.push({ name: inner.text, bound: null, variance: "TypeVar" });
    } else if (inner.type === "splat_type") {
      // *Ts → TypeVarTuple, **P → ParamSpec
      const stars = inner.children[0]?.text ?? "";
      const name = inner.children[1]?.text ?? inner.text.replace(/^\*+/, "");
      result.push({
        name,
        bound: null,
        variance: stars === "**" ? "ParamSpec" : "TypeVarTuple",
      });
    } else if (inner.type === "constrained_type") {
      // S: str  →  constrained_type: type ":" type
      const nameNode = inner.children[0]; // first child is a "type" node
      const boundNode = inner.children[2]; // third child is the bound type
      // The name node is a "type" wrapping an "identifier"
      const name = nameNode?.namedChildren[0]?.text ?? nameNode?.text ?? "";
      const bound = boundNode?.text ?? null;
      result.push({ name, bound, variance: "TypeVar" });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

function extractParams(paramsNode: SyntaxNode): Param[] {
  const result: Param[] = [];
  // Tracks params collected before we see a "/" so we can mark them positional-only
  const pendingPositionalOnly: Param[] = [];
  let seenPositionalSep = false;
  let keywordOnly = false;

  for (const child of paramsNode.children) {
    switch (child.type) {
      case "(":
      case ")":
      case ",":
        break;

      case "positional_separator":
        // Everything in pendingPositionalOnly is positional-only
        for (const p of pendingPositionalOnly) {
          p.kind = "positional-only";
        }
        seenPositionalSep = true;
        pendingPositionalOnly.length = 0;
        break;

      case "keyword_separator":
        // "*" alone — subsequent regular params are keyword-only
        keywordOnly = true;
        break;

      case "identifier": {
        // Plain untyped, undefaulted param
        const name = child.text;
        if (name === "self" || name === "cls") break;
        const p: Param = {
          name,
          kind: keywordOnly ? "keyword-only" : "regular",
          annotation: null,
          default: null,
          isOptional: false,
        };
        if (!seenPositionalSep) pendingPositionalOnly.push(p);
        result.push(p);
        break;
      }

      case "default_parameter": {
        // name = value  (no type)
        const nameNode = child.childForFieldName("name") ?? child.namedChildren[0];
        const name = nameNode?.text ?? "";
        if (name === "self" || name === "cls") break;
        const defaultVal = child.childForFieldName("value")?.text ?? null;
        const p: Param = {
          name,
          kind: keywordOnly ? "keyword-only" : "regular",
          annotation: null,
          default: defaultVal,
          isOptional: true,
        };
        if (!seenPositionalSep) pendingPositionalOnly.push(p);
        result.push(p);
        break;
      }

      case "typed_parameter": {
        // Can be:  name: Type  |  *args: Type  |  **kwargs: Type
        const firstNamed = child.namedChildren[0];
        if (!firstNamed) break;
        const typeNode = child.namedChildren.find((c) => c.type === "type");
        const annotation = typeNode?.text ?? null;

        if (firstNamed.type === "list_splat_pattern") {
          // *args: Type
          const name = firstNamed.text.replace(/^\*+/, "");
          result.push({
            name,
            kind: "args",
            annotation,
            default: null,
            isOptional: false,
          });
        } else if (firstNamed.type === "dictionary_splat_pattern") {
          // **kwargs: Type
          const name = firstNamed.text.replace(/^\*+/, "");
          result.push({
            name,
            kind: "kwargs",
            annotation,
            default: null,
            isOptional: false,
          });
        } else {
          // Regular typed param: name: Type
          const name = firstNamed.text;
          if (name === "self" || name === "cls") break;
          const p: Param = {
            name,
            kind: keywordOnly ? "keyword-only" : "regular",
            annotation,
            default: null,
            isOptional: false,
          };
          if (!seenPositionalSep) pendingPositionalOnly.push(p);
          result.push(p);
        }
        break;
      }

      case "typed_default_parameter": {
        // name: Type = value
        const nameNode =
          child.childForFieldName("name") ??
          child.namedChildren.find((c) => c.type === "identifier");
        const name = nameNode?.text ?? "";
        if (name === "self" || name === "cls") break;
        const typeNode = child.namedChildren.find((c) => c.type === "type");
        const annotation = typeNode?.text ?? null;
        const defaultVal = child.childForFieldName("value")?.text ?? null;
        const p: Param = {
          name,
          kind: keywordOnly ? "keyword-only" : "regular",
          annotation,
          default: defaultVal,
          isOptional: true,
        };
        if (!seenPositionalSep) pendingPositionalOnly.push(p);
        result.push(p);
        break;
      }

      case "list_splat_pattern": {
        // *args  (no type annotation)
        const name = child.text.replace(/^\*+/, "");
        result.push({
          name,
          kind: "args",
          annotation: null,
          default: null,
          isOptional: false,
        });
        break;
      }

      case "dictionary_splat_pattern": {
        // **kwargs  (no type annotation)
        const name = child.text.replace(/^\*+/, "");
        result.push({
          name,
          kind: "kwargs",
          annotation: null,
          default: null,
          isOptional: false,
        });
        break;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Generator detection (shallow — does not recurse into nested functions)
// ---------------------------------------------------------------------------

function hasYield(bodyNode: SyntaxNode): boolean {
  return _findYield(bodyNode.children);
}

function _findYield(nodes: SyntaxNode[]): boolean {
  for (const node of nodes) {
    if (node.type.startsWith("yield")) return true;
    // Don't cross into nested function/class boundaries
    if (
      node.type === "function_definition" ||
      node.type === "class_definition" ||
      node.type === "decorated_definition"
    ) {
      continue;
    }
    if (_findYield(node.children)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Class attribute extraction
// ---------------------------------------------------------------------------

function extractClassAttributes(bodyNode: SyntaxNode): ClassAttribute[] {
  const attrs: ClassAttribute[] = [];
  for (const stmt of bodyNode.namedChildren) {
    if (stmt.type !== "expression_statement") continue;
    const inner = stmt.namedChildren[0];
    // Only annotated assignments have a ":" child followed by a "type" child
    if (!inner || inner.type !== "assignment") continue;
    const colonIdx = inner.children.findIndex((c) => c.type === ":");
    if (colonIdx === -1) continue; // plain assignment, no annotation
    const nameNode = inner.children[0];
    const typeNode = inner.children.find((c) => c.type === "type");
    if (!nameNode || !typeNode) continue;
    const name = nameNode.text;
    const annotation = typeNode.text;
    const isClassVar = annotation.startsWith("ClassVar[") || annotation.includes("ClassVar[");
    attrs.push({ name, annotation, isClassVar });
  }
  return attrs;
}

// ---------------------------------------------------------------------------
// Scope level
// ---------------------------------------------------------------------------

function determineScopeLevel(fnNode: SyntaxNode): FunctionInfo["scopeLevel"] {
  // The function's parent is either:
  //   - "module"                           → module level
  //   - "decorated_definition" → "module"  → module level
  //   - "block" whose parent is a class    → class level
  //   - "block" whose parent is a function → function level
  let parent = fnNode.parent;
  if (parent?.type === "decorated_definition") parent = parent.parent;
  if (!parent || parent.type === "module") return "module";
  if (parent.type === "block") {
    let owner = parent.parent;
    if (owner?.type === "decorated_definition") {
      owner =
        owner.namedChildren.find(
          (c) => c.type === "class_definition" || c.type === "function_definition",
        ) ?? owner;
    }
    if (owner?.type === "class_definition") return "class";
    return "function";
  }
  return "module";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract FunctionInfo from a `function_definition` node.
 *
 * @param fnNode    The `function_definition` SyntaxNode.
 * @param decorators Decorator text strings collected from the enclosing
 *                   `decorated_definition` (if any).
 */
export function extractFunctionInfo(fnNode: SyntaxNode, decorators: string[] = []): FunctionInfo {
  const name = fnNode.childForFieldName("name")?.text ?? "<unknown>";
  const isAsync = fnNode.children[0]?.type === "async";
  const paramsNode = fnNode.childForFieldName("parameters");
  const params = paramsNode ? extractParams(paramsNode) : [];
  const returnAnnotation = fnNode.childForFieldName("return_type")?.text ?? null;
  const tpsNode = fnNode.childForFieldName("type_parameters");
  const typeParams = extractTypeParams(tpsNode ?? null);
  const bodyNode = fnNode.childForFieldName("body");
  const docstring = bodyNode ? extractExistingDocstring(bodyNode) : null;
  const isGenerator = bodyNode ? hasYield(bodyNode) : false;
  const scopeLevel = determineScopeLevel(fnNode);

  return {
    kind: "function",
    name,
    params,
    returnAnnotation,
    decorators,
    isAsync,
    isGenerator,
    typeParams,
    docstring,
    bodyRange: bodyNode ? nodeRange(bodyNode) : nodeRange(fnNode),
    signatureRange: nodeRange(fnNode),
    scopeLevel,
  };
}

/**
 * Extract ClassInfo from a `class_definition` node.
 *
 * @param classNode      The `class_definition` SyntaxNode.
 * @param decorators     Decorator text strings from the enclosing
 *                        `decorated_definition` (if any).
 * @param mergeInitParams When true, `__init__` parameters (minus `self`) are
 *                        hoisted into `initParams`.
 */
export function extractClassInfo(
  classNode: SyntaxNode,
  decorators: string[] = [],
  mergeInitParams = false,
): ClassInfo {
  const name = classNode.childForFieldName("name")?.text ?? "<unknown>";
  const tpsNode = classNode.childForFieldName("type_parameters");
  const typeParams = extractTypeParams(tpsNode ?? null);
  const bodyNode = classNode.childForFieldName("body");
  const docstring = bodyNode ? extractExistingDocstring(bodyNode) : null;
  const attributes = bodyNode ? extractClassAttributes(bodyNode) : [];

  let initParams: Param[] = [];
  if (mergeInitParams && bodyNode) {
    for (const child of bodyNode.namedChildren) {
      let fnNode: SyntaxNode | null = null;
      if (child.type === "function_definition") {
        fnNode = child;
      } else if (child.type === "decorated_definition") {
        fnNode = child.namedChildren.find((c) => c.type === "function_definition") ?? null;
      }
      if (fnNode && fnNode.childForFieldName("name")?.text === "__init__") {
        const paramsNode = fnNode.childForFieldName("parameters");
        initParams = paramsNode ? extractParams(paramsNode).filter((p) => p.name !== "self") : [];
        break;
      }
    }
  }

  return {
    kind: "class",
    name,
    decorators,
    typeParams,
    attributes,
    initParams,
    docstring,
    bodyRange: bodyNode ? nodeRange(bodyNode) : nodeRange(classNode),
    signatureRange: nodeRange(classNode),
  };
}
