import * as vscode from "vscode";
import {
  buildGoogleDocstring,
  findSignatureFromLines,
  isGeneratorFunction,
  isModuleLevelLines,
} from "./parser";

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
    const found = findSignatureFromLines(lines, position.line - 1);

    let snippetBody: string;
    if (found) {
      const isGenerator = isGeneratorFunction(lines, found.defLine, position.line + 1);
      snippetBody = buildGoogleDocstring(found.sig, indent, quoteChar, { isGenerator });
    } else if (isModuleLevelLines(lines, position.line - 1)) {
      snippetBody = `\${1:_summary_}\n${indent}${quoteChar}`;
    } else {
      return [];
    }

    // Build the full snippet with explicit indentation on every line.
    // We replace the entire trigger line so that neither ghost-text preview
    // nor snippet acceptance need to apply indentation normalization.
    const bodyLines = snippetBody.split("\n");
    const fullSnippet =
      indent +
      quoteChar +
      bodyLines[0] +
      "\n" +
      bodyLines
        .slice(1)
        .map((l) => (l === "" ? "" : indent + l))
        .join("\n");

    const lineStart = new vscode.Position(position.line, 0);
    const range = new vscode.Range(lineStart, position.with(undefined, lineText.length));
    return [new vscode.InlineCompletionItem(new vscode.SnippetString(fullSnippet), range)];
  }
}
