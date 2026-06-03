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

    // The snippet replaces the typed `"""` and continues from that position
    const snippetItem = new vscode.InlineCompletionItem(
      new vscode.SnippetString(result.snippet.slice(3)), // strip the leading `"""` already typed
      new vscode.Range(position, position),
    );

    return new vscode.InlineCompletionList([snippetItem]);
  }
}
