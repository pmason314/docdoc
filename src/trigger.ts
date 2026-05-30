import * as vscode from "vscode";

// Matches: def foo(a: int, b: str = "x", *args, **kwargs) -> bool:
const DEF_RE = /^(\s*)def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(.+?)\s*)?:\s*$/;
// Matches: class Foo:  or  class Foo(Base):
const CLASS_RE = /^(\s*)class\s+(\w+)/;
// Matches a decorator line
const DECORATOR_RE = /^\s*@/;

interface ParsedSignature {
  kind: "def" | "class";
  name: string;
  params: Param[];
  returnAnnotation: string | null;
}

interface Param {
  name: string;
  annotation: string | null;
  hasDefault: boolean;
}

/**
 * Split a parameter list string into individual parameter strings,
 * respecting nested brackets so "a: Dict[str, int] = {}" is one token.
 */
function splitParams(raw: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    if (ch === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = "";
    } else {
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") depth--;
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) result.push(trimmed);
  return result;
}

/**
 * Parse one parameter token like "a", "a: int", "b: str = 'x'", "*args", "**kwargs".
 */
function parseParam(token: string): Param | null {
  // Strip leading * or **
  const strippedToken = token.replace(/^\*{1,2}/, "");
  if (!strippedToken) return null; // bare * separator

  // Split on first = to separate annotation from default
  const eqIdx = token.indexOf("=");
  const hasDefault = eqIdx !== -1;
  const beforeEq = hasDefault ? token.slice(0, eqIdx).trim() : token.trim();

  // Strip * prefix again for annotation parsing
  const withoutStars = beforeEq.replace(/^\*{1,2}/, "");

  const colonIdx = withoutStars.indexOf(":");
  if (colonIdx !== -1) {
    return {
      name: withoutStars.slice(0, colonIdx).trim(),
      annotation: withoutStars.slice(colonIdx + 1).trim(),
      hasDefault,
    };
  }
  return { name: withoutStars.trim(), annotation: null, hasDefault };
}

/**
 * Returns true if every line above startLine is blank or a comment,
 * meaning the triple quote is at module scope.
 */
function isModuleLevel(document: vscode.TextDocument, startLine: number): boolean {
  for (let i = startLine; i >= 0; i--) {
    const text = document.lineAt(i).text.trim();
    if (text === "" || text.startsWith("#")) continue;
    return false;
  }
  return true;
}

/**
 * Scan upward from startLine to find the nearest def/class signature,
 * skipping blank lines and decorator lines.
 */
function findSignature(document: vscode.TextDocument, startLine: number): ParsedSignature | null {
  for (let i = startLine; i >= 0 && i >= startLine - 30; i--) {
    const text = document.lineAt(i).text;

    const defMatch = DEF_RE.exec(text);
    if (defMatch) {
      const rawParams = defMatch[3] ?? "";
      const returnStr = defMatch[4] ?? null;

      const params: Param[] = [];
      for (const token of splitParams(rawParams)) {
        const p = parseParam(token);
        if (!p) continue;
        if (p.name === "self" || p.name === "cls") continue;
        params.push(p);
      }

      return {
        kind: "def",
        name: defMatch[2],
        params,
        returnAnnotation: returnStr,
      };
    }

    const classMatch = CLASS_RE.exec(text);
    if (classMatch) {
      return { kind: "class", name: classMatch[2], params: [], returnAnnotation: null };
    }

    // Keep scanning through blank lines and decorators
    if (text.trim() !== "" && !DECORATOR_RE.test(text)) {
      break; // hit something that isn't a def/class/decorator/blank — stop
    }
  }
  return null;
}

/**
 * Build a Google-style docstring SnippetString.
 * The cursor is placed right after the opening `"""`, so insertText
 * starts immediately (no leading quote).
 *
 * Result shape (example):
 *   ${1:_summary_}
 *
 *   Args:
 *       a (int): ${2:_description_}
 *       b (str): ${3:_description_}. Defaults to "x".
 *
 *   Returns:
 *       bool: ${4:_description_}
 *   """
 */
function buildSnippet(
  sig: ParsedSignature,
  indent: string,
  quoteChar: string,
): vscode.SnippetString {
  const inner = indent + "    "; // one extra level for docstring body
  const snippet = new vscode.SnippetString();
  let tabStop = 1;

  // Summary line
  snippet.appendPlaceholder("_summary_", tabStop++);

  if (sig.kind === "def" && sig.params.length > 0) {
    snippet.appendText("\n\n" + inner + "Args:\n");
    for (const p of sig.params) {
      const typeHint = p.annotation ? ` (${p.annotation})` : "";
      snippet.appendText(inner + "    " + p.name + typeHint + ": ");
      snippet.appendPlaceholder("_description_", tabStop++);
      snippet.appendText("\n");
    }
  }

  const skipReturn =
    sig.kind !== "def" || sig.returnAnnotation === null || sig.returnAnnotation === "None";

  if (!skipReturn) {
    snippet.appendText("\n" + inner + "Returns:\n");
    snippet.appendText(inner + "    " + sig.returnAnnotation! + ": ");
    snippet.appendPlaceholder("_description_", tabStop++);
    snippet.appendText("\n");
  }

  snippet.appendText(indent + quoteChar);
  return snippet;
}

export class DocstringTrigger implements vscode.InlineCompletionItemProvider {
  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    _token: vscode.CancellationToken,
  ): vscode.InlineCompletionItem[] {
    // Don't fight the autocomplete widget
    if (context.selectedCompletionInfo) return [];

    const lineText = document.lineAt(position.line).text;
    const textUpToCursor = lineText.slice(0, position.character);

    // Detect triple quote at cursor: must end with """ or '''
    const tripleQuoteMatch = /^(\s*)("""|''')$/.exec(textUpToCursor);
    if (!tripleQuoteMatch) return [];

    const indent = tripleQuoteMatch[1];
    const quoteChar = tripleQuoteMatch[2];

    // Find the def/class above, or fall back to module-level
    const sig = findSignature(document, position.line - 1);

    let snippet: vscode.SnippetString;
    if (sig) {
      snippet = buildSnippet(sig, indent, quoteChar);
    } else if (isModuleLevel(document, position.line - 1)) {
      snippet = new vscode.SnippetString();
      snippet.appendPlaceholder("_summary_");
      snippet.appendText("\n" + indent + quoteChar);
    } else {
      return [];
    }

    // Replace from cursor to end-of-line (clears any trailing chars on the same line)
    const range = new vscode.Range(position, position.with(undefined, lineText.length));

    return [new vscode.InlineCompletionItem(snippet, range)];
  }
}
