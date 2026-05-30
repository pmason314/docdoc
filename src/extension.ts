import * as vscode from "vscode";
import { GenerateDocstringActionProvider } from "./codeAction";
import { generate, generateFile } from "./commands";
import { DocstringTrigger } from "./trigger";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { language: "python" },
      new DocstringTrigger(),
    ),

    vscode.commands.registerTextEditorCommand("docstringGenerator.generate", generate),
    vscode.commands.registerTextEditorCommand("docstringGenerator.generateFile", generateFile),

    vscode.languages.registerCodeActionsProvider(
      { language: "python" },
      new GenerateDocstringActionProvider(),
      { providedCodeActionKinds: GenerateDocstringActionProvider.providedKinds },
    ),
  );
}

export function deactivate(): void {}
