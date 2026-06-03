/**
 * On-save handler: optionally auto-generate docstrings when a Python file
 * is saved (disabled by default).
 */
import * as vscode from "vscode";
import { applyInsertions, generateFileInsertions } from "./parser/index.js";
import { getConfig } from "./config.js";

export function registerOnSaveHandler(context: vscode.ExtensionContext): void {
  const disposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (document.languageId !== "python") return;

    const cfg = getConfig();
    if (!cfg || !vscode.workspace.getConfiguration("docdoc").get<boolean>("onSave.enable")) {
      return;
    }

    const editor = vscode.window.visibleTextEditors.find((e) => e.document === document);
    if (!editor) return;

    const lines = document.getText().split("\n");
    if (lines[lines.length - 1] === "") lines.pop();

    const insertions = generateFileInsertions(lines, cfg);
    if (insertions.length === 0) return;

    const resultLines = applyInsertions(lines, insertions);
    const newText = resultLines.join("\n") + "\n";

    const fullRange = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(
        document.lineCount - 1,
        document.lineAt(document.lineCount - 1).text.length,
      ),
    );
    await editor.edit((eb) => eb.replace(fullRange, newText));
  });

  context.subscriptions.push(disposable);
}
