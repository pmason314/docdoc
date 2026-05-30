import * as vscode from "vscode";
import { buildGoogleDocstring, findSignatureFromLines, isModuleLevelLines } from "./parser";

function docLines(document: vscode.TextDocument): string[] {
  return Array.from({ length: document.lineCount }, (_, i) => document.lineAt(i).text);
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

    const lines = docLines(document);
    const sig = findSignatureFromLines(lines, position.line - 1);

    let snippetValue: string;
    if (sig) {
      snippetValue = buildGoogleDocstring(sig, indent, quoteChar);
    } else if (isModuleLevelLines(lines, position.line - 1)) {
      snippetValue = `\${1:_summary_}\n${indent}${quoteChar}`;
    } else {
      return [];
    }

    const range = new vscode.Range(position, position.with(undefined, lineText.length));
    return [new vscode.InlineCompletionItem(new vscode.SnippetString(snippetValue), range)];
  }
}
