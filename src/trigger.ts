/**
 * Inline completion provider.
 *
 * Fires when the user types `"""` or `'''` as the first non-whitespace content
 * on a line inside (or just after) a function/class definition, and yields a
 * snippet docstring as the completion.
 */
import * as vscode from "vscode";
import { getConfig } from "./config.js";
import { buildSnippetForLine, findSignatureAtLine } from "./parser/index.js";

// Characters that trigger inline completion
const TRIGGER_CHARS = ['"', "'"];

export class DocstringTrigger implements vscode.InlineCompletionItemProvider {
  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.InlineCompletionList | null {
    const lineText = document.lineAt(position.line).text;
    const prefix = lineText.slice(0, position.character).trimStart();

    // Only activate on `"""` or `'''` typed as the full line prefix
    const isDouble = prefix === '"""';
    const isSingle = prefix === "'''";
    if (!isDouble && !isSingle) return null;

    const cfg = getConfig();
    // If the configured quote style doesn't match, skip
    if (cfg.quoteStyle === "double" && !isDouble) return null;
    if (cfg.quoteStyle === "single" && !isSingle) return null;

    const lines = document.getText().split("\n");
    const result = buildSnippetForLine(lines, position.line, cfg);
    if (!result) return null;

    // The snippet starts with `<bodyIndent><quotes>…`.  Fix up indentation
    // when tree-sitter misparses (e.g. another docstring exists later in the
    // file, causing bodyIndent to be wrong).
    const quote = isDouble ? '"""' : "'''";
    const quoteIdx = result.snippet.indexOf(quote);
    const snippetBodyIndent = result.snippet.slice(0, quoteIdx);
    const triggerIndent = lineText.slice(0, lineText.length - lineText.trimStart().length);

    let snippet = result.snippet;

    // Normalize all lines to use the trigger line's actual indentation
    if (snippetBodyIndent !== triggerIndent) {
      const snippetLines = snippet.split("\n");
      for (let i = 0; i < snippetLines.length; i++) {
        if (snippetBodyIndent === "") {
          snippetLines[i] = triggerIndent + snippetLines[i];
        } else if (snippetLines[i].startsWith(snippetBodyIndent)) {
          snippetLines[i] = triggerIndent + snippetLines[i].slice(snippetBodyIndent.length);
        }
      }
      snippet = snippetLines.join("\n");
    }

    // Use a range starting at column 0 so VS Code's snippet adjustWhitespace
    // sees an empty reference indent and won't add extra indentation on
    // acceptance.  The snippet contains the full line (indent + quotes + body)
    // which gives correct ghost text display AND correct accepted text.
    const lineStart = new vscode.Position(position.line, 0);
    const lineEnd = new vscode.Position(position.line, lineText.length);
    const snippetItem = new vscode.InlineCompletionItem(
      new vscode.SnippetString(snippet),
      new vscode.Range(lineStart, lineEnd),
    );

    return new vscode.InlineCompletionList([snippetItem]);
  }
}
