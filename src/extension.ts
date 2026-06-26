/**
 * Extension entry point.
 */
import * as vscode from "vscode";
import { initParser } from "./parser/index.js";
import {
  generate,
  generateFile,
  update,
  updateFile,
  convertFormat,
  convertFileFormat,
} from "./commands.js";
import { DocstringTrigger } from "./trigger.js";
import { GenerateDocstringActionProvider } from "./codeAction.js";
import { registerOnSaveHandler } from "./onSave.js";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialise tree-sitter (async WASM load — happens once)
  try {
    await initParser();
  } catch (err) {
    vscode.window.showErrorMessage(`Docdoc: Failed to initialise parser — ${String(err)}`);
    return;
  }

  const PYTHON_SELECTOR: vscode.DocumentSelector = [
    { language: "python" },
    { language: "python", notebookType: "jupyter-notebook" },
    { language: "python", notebookType: "interactive" },
  ];

  // Inline completion ("""/ ''' trigger)
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(PYTHON_SELECTOR, new DocstringTrigger()),
  );

  // Code actions (lightbulb)
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      PYTHON_SELECTOR,
      new GenerateDocstringActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  );

  // Commands
  const reg = (id: string, handler: (e: vscode.TextEditor) => Promise<void>) =>
    vscode.commands.registerTextEditorCommand(id, handler);

  context.subscriptions.push(
    reg("docdoc.generate", generate),
    reg("docdoc.generateFile", generateFile),
    reg("docdoc.update", update),
    reg("docdoc.updateFile", updateFile),
    reg("docdoc.convertFormat", convertFormat),
    reg("docdoc.convertFileFormat", convertFileFormat),
  );

  // On-save handler
  registerOnSaveHandler(context);
}

export function deactivate(): void {
  // Nothing to clean up
}
