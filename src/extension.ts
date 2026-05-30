import * as vscode from "vscode";
import { DocstringTrigger } from "./trigger";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { language: "python" },
      new DocstringTrigger(),
    ),
  );
}

export function deactivate(): void {}
