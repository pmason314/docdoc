/**
 * Code action provider — shows a "Generate docstring" lightbulb on
 * undocumented `def` / `class` lines.
 */
import * as vscode from "vscode";
import { hasDocstring } from "./parser/signatureParser.js";
import { findDefNodeAtLine } from "./parser/signatureParser.js";
import { parseCode } from "./parser/treeSitter.js";

export class GenerateDocstringActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] | null {
    const line = range.start.line;
    const lines = document.getText().split("\n");
    const code = lines.join("\n");

    let tree;
    try {
      tree = parseCode(code);
    } catch {
      return null;
    }

    if (!tree) return null;
    const found = findDefNodeAtLine(tree, line);
    if (!found) return null;
    if (hasDocstring(found.def)) return null;

    const action = new vscode.CodeAction("Generate docstring", vscode.CodeActionKind.QuickFix);
    action.command = {
      command: "docdoc.generate",
      title: "Generate docstring",
    };
    return [action];
  }
}
