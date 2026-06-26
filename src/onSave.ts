/**
 * On-save handler: optionally auto-generate docstrings when a Python file
 * or notebook is saved (disabled by default).
 */
import * as vscode from "vscode";
import { applyInsertions, generateFileInsertions } from "./parser/index.js";
import { getConfig } from "./config.js";

async function processDocument(document: vscode.TextDocument): Promise<void> {
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
}

export function registerOnSaveHandler(context: vscode.ExtensionContext): void {
  // Handle regular Python file saves
  const disposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
    await processDocument(document);
  });

  // Handle notebook saves — process each Python cell
  const notebookDisposable = vscode.workspace.onDidSaveNotebookDocument(async (notebook) => {
    for (const cell of notebook.notebook.getCells()) {
      if (cell.kind === vscode.NotebookCellKind.Code && cell.document.languageId === "python") {
        await processDocument(cell.document);
      }
    }
  });

  context.subscriptions.push(disposable, notebookDisposable);
}
