import * as vscode from "vscode";
import {
  applyInsertions,
  buildGoogleDocstringText,
  findSignatureFromLines,
  generateFileInsertions,
  hasDocstring,
  isGeneratorFunction,
} from "./parser";

function docLines(document: vscode.TextDocument): string[] {
  return Array.from({ length: document.lineCount }, (_, i) => document.lineAt(i).text);
}

/** Insert text as a new line after `afterLine` in the given document. */
function insertionEdit(
  document: vscode.TextDocument,
  afterLine: number,
  text: string,
): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit();
  const insertPos = new vscode.Position(afterLine + 1, 0);
  edit.insert(document.uri, insertPos, text + "\n");
  return edit;
}

// ---------------------------------------------------------------------------
// generate — insert a docstring for the def/class at/above the cursor
// ---------------------------------------------------------------------------

export async function generate(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;
  const cursorLine = editor.selection.active.line;
  const lines = docLines(document);

  const found = findSignatureFromLines(lines, cursorLine);
  if (!found) {
    vscode.window.showInformationMessage("No function or class found at cursor.");
    return;
  }

  const { sig, defLine } = found;

  // Determine the last line of the signature (for multi-line sigs)
  let sigEndLine = defLine;
  if (!lines[defLine].trimEnd().endsWith(":")) {
    let depth = 0;
    for (const ch of lines[defLine]) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    let j = defLine + 1;
    while (j < lines.length && depth > 0) {
      for (const ch of lines[j]) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      j++;
    }
    sigEndLine = j - 1;
  }

  if (hasDocstring(lines, sigEndLine)) {
    vscode.window.showInformationMessage("Docstring already exists.");
    return;
  }

  const defText = lines[defLine];
  const defIndent = (defText.match(/^(\s*)/) ?? ["", ""])[1];
  const bodyIndent = defIndent + "    ";
  const isGenerator = isGeneratorFunction(lines, defLine, sigEndLine + 1);
  const docText = buildGoogleDocstringText(sig, bodyIndent, '"""', { isGenerator });

  const edit = insertionEdit(document, sigEndLine, docText);
  await vscode.workspace.applyEdit(edit);
}

// ---------------------------------------------------------------------------
// generateFile — insert docstrings for all undocumented defs/classes
// ---------------------------------------------------------------------------

export async function generateFile(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;
  const lines = docLines(document);
  const insertions = generateFileInsertions(lines);

  if (insertions.length === 0) {
    vscode.window.showInformationMessage("All functions already have docstrings.");
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  for (const ins of insertions) {
    const insertPos = new vscode.Position(ins.afterLine + 1, 0);
    edit.insert(document.uri, insertPos, ins.text + "\n");
  }
  await vscode.workspace.applyEdit(edit);
}
