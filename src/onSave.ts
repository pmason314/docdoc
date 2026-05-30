import * as vscode from "vscode";
import { generateFileInsertions } from "./parser";

export function registerOnSaveHandler(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
      if (document.languageId !== "python") return;

      const enabled = vscode.workspace
        .getConfiguration("docstringGenerator")
        .get<boolean>("onSave.enable", false);
      if (!enabled) return;

      const lines = Array.from({ length: document.lineCount }, (_, i) => document.lineAt(i).text);
      const insertions = generateFileInsertions(lines);
      if (insertions.length === 0) return;

      const edit = new vscode.WorkspaceEdit();
      for (const ins of insertions) {
        const insertPos = new vscode.Position(ins.afterLine + 1, 0);
        edit.insert(document.uri, insertPos, ins.text + "\n");
      }
      await vscode.workspace.applyEdit(edit);
    }),
  );
}
