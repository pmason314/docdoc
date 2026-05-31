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

    vscode.commands.registerTextEditorCommand("docdoc.generate", generate),
    vscode.commands.registerTextEditorCommand("docdoc.generateFile", generateFile),
    vscode.commands.registerTextEditorCommand("docdoc.update", update),
    vscode.commands.registerTextEditorCommand("docdoc.updateFile", updateFile),
    vscode.commands.registerTextEditorCommand("docdoc.convertFormat", convert),
    vscode.commands.registerTextEditorCommand(
      "docdoc.convertFileFormat",
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
