import * as vscode from "vscode";
import { GenerateDocstringActionProvider } from "./codeAction";
import { convert, convertFileFormat, generate, generateFile, update, updateFile } from "./commands";
import { registerOnSaveHandler } from "./onSave";
import { DocstringTrigger } from "./trigger";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { language: "python" },
      new DocstringTrigger(),
    ),

    vscode.commands.registerTextEditorCommand("docstringGenerator.generate", generate),
    vscode.commands.registerTextEditorCommand("docstringGenerator.generateFile", generateFile),
    vscode.commands.registerTextEditorCommand("docstringGenerator.update", update),
    vscode.commands.registerTextEditorCommand("docstringGenerator.updateFile", updateFile),
    vscode.commands.registerTextEditorCommand("docstringGenerator.convertFormat", convert),
    vscode.commands.registerTextEditorCommand(
      "docstringGenerator.convertFileFormat",
      convertFileFormat,
    ),

    vscode.languages.registerCodeActionsProvider(
      { language: "python" },
      new GenerateDocstringActionProvider(),
      { providedCodeActionKinds: GenerateDocstringActionProvider.providedKinds },
    ),
  );

  registerOnSaveHandler(context);
}
export function deactivate(): void {}
