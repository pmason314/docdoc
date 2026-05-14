import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const commands = [
    "docstringGenerator.generate",
    "docstringGenerator.generateFile",
    "docstringGenerator.update",
    "docstringGenerator.updateFile",
    "docstringGenerator.convertFormat",
    "docstringGenerator.convertFileFormat",
  ];

  for (const id of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => {
        vscode.window.showInformationMessage(`${id}: not yet implemented.`);
      }),
    );
  }
}

export function deactivate() {
  // no-op: subprocess invocations are one-shot and need no teardown
}
