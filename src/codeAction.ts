import * as vscode from "vscode";
import { CLASS_RE, DEF_RE, hasDocstring } from "./parser";

export class GenerateDocstringActionProvider implements vscode.CodeActionProvider {
  static readonly providedKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (let i = range.start.line; i <= range.end.line; i++) {
      const text = document.lineAt(i).text;
      if (!DEF_RE.test(text) && !CLASS_RE.test(text)) continue;

      // Check for existing docstring (look ahead past the sig end)
      const lines = Array.from({ length: document.lineCount }, (_, n) =>
        document.lineAt(n).text,
      );
      if (hasDocstring(lines, i)) continue;

      const action = new vscode.CodeAction(
        "Generate docstring",
        vscode.CodeActionKind.QuickFix,
      );
      action.command = {
        command: "docstringGenerator.generate",
        title: "Generate docstring",
        arguments: [{ line: i }],
      };
      action.isPreferred = true;
      actions.push(action);
    }

    return actions;
  }
}
