/**
 * Command implementations for all six docdoc commands.
 */
import * as vscode from "vscode";
import { getConfig } from "./config.js";
import {
  applyInsertions,
  applyReplacements,
  buildDocstringForLine,
  buildUpdateForLine,
  generateFileInsertions,
  getUpdateOperations,
} from "./parser/index.js";

// ---------------------------------------------------------------------------
// Generate (single)
// ---------------------------------------------------------------------------

export async function generate(editor: vscode.TextEditor): Promise<void> {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  const lineNum = editor.selection.active.line;

  const result = buildDocstringForLine(lines, lineNum, cfg);
  if (!result) {
    vscode.window.showInformationMessage(
      "Docdoc: No undocumented function or class found at cursor.",
    );
    return;
  }

  const insertAt = new vscode.Position(result.afterLine + 1, 0);
  const text = result.docText
    .split("\n")
    .map((l) => l + "\n")
    .join("");
  await editor.edit((eb) => eb.insert(insertAt, text));
}

// ---------------------------------------------------------------------------
// Generate File
// ---------------------------------------------------------------------------

export async function generateFile(editor: vscode.TextEditor): Promise<void> {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  // Remove trailing empty element from final newline
  if (lines[lines.length - 1] === "") lines.pop();

  const insertions = generateFileInsertions(lines, cfg);
  if (insertions.length === 0) {
    vscode.window.showInformationMessage(
      "Docdoc: All functions and classes are already documented.",
    );
    return;
  }

  const resultLines = applyInsertions(lines, insertions);
  const newText = resultLines.join("\n") + "\n";

  const fullRange = new vscode.Range(
    new vscode.Position(0, 0),
    new vscode.Position(
      editor.document.lineCount - 1,
      editor.document.lineAt(editor.document.lineCount - 1).text.length,
    ),
  );
  await editor.edit((eb) => eb.replace(fullRange, newText));
}

// ---------------------------------------------------------------------------
// Update (single)
// ---------------------------------------------------------------------------

export async function update(editor: vscode.TextEditor): Promise<void> {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  const lineNum = editor.selection.active.line;

  const replacement = buildUpdateForLine(lines, lineNum, cfg);
  if (!replacement) {
    vscode.window.showInformationMessage(
      "Docdoc: No documented function or class found at cursor.",
    );
    return;
  }

  const range = new vscode.Range(
    new vscode.Position(replacement.startLine, 0),
    new vscode.Position(replacement.endLine, lines[replacement.endLine]?.length ?? 0),
  );
  await editor.edit((eb) => eb.replace(range, replacement.newLines.join("\n")));
}

// ---------------------------------------------------------------------------
// Update File
// ---------------------------------------------------------------------------

export async function updateFile(editor: vscode.TextEditor): Promise<void> {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  if (lines[lines.length - 1] === "") lines.pop();

  const ops = getUpdateOperations(lines, cfg);
  if (ops.length === 0) {
    vscode.window.showInformationMessage("Docdoc: Nothing to update.");
    return;
  }

  const resultLines = applyReplacements(lines, ops);
  const newText = resultLines.join("\n") + "\n";

  const fullRange = new vscode.Range(
    new vscode.Position(0, 0),
    new vscode.Position(
      editor.document.lineCount - 1,
      editor.document.lineAt(editor.document.lineCount - 1).text.length,
    ),
  );
  await editor.edit((eb) => eb.replace(fullRange, newText));
}

// ---------------------------------------------------------------------------
// Convert Format (single)
// ---------------------------------------------------------------------------

export async function convertFormat(editor: vscode.TextEditor): Promise<void> {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  const lineNum = editor.selection.active.line;

  // Convert = update with the same signature (forces re-render in current format)
  const replacement = buildUpdateForLine(lines, lineNum, cfg);
  if (!replacement) {
    vscode.window.showInformationMessage(
      "Docdoc: No documented function or class found at cursor.",
    );
    return;
  }

  const range = new vscode.Range(
    new vscode.Position(replacement.startLine, 0),
    new vscode.Position(replacement.endLine, lines[replacement.endLine]?.length ?? 0),
  );
  await editor.edit((eb) => eb.replace(range, replacement.newLines.join("\n")));
}

// ---------------------------------------------------------------------------
// Convert File Format
// ---------------------------------------------------------------------------

export async function convertFileFormat(editor: vscode.TextEditor): Promise<void> {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  if (lines[lines.length - 1] === "") lines.pop();

  const ops = getUpdateOperations(lines, cfg);
  if (ops.length === 0) {
    vscode.window.showInformationMessage("Docdoc: No documented functions or classes found.");
    return;
  }

  const resultLines = applyReplacements(lines, ops);
  const newText = resultLines.join("\n") + "\n";

  const fullRange = new vscode.Range(
    new vscode.Position(0, 0),
    new vscode.Position(
      editor.document.lineCount - 1,
      editor.document.lineAt(editor.document.lineCount - 1).text.length,
    ),
  );
  await editor.edit((eb) => eb.replace(fullRange, newText));
}
