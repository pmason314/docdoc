import * as vscode from "vscode";
import {
  applyInsertions,
  buildGoogleDocstringText,
  buildUpdateText,
  findSignatureFromLines,
  generateFileInsertions,
  hasDocstring,
  isGeneratorFunction,
  renderGoogleDocstring,
} from "./parser";
import { parseGoogleDocstring } from "./docstringParser";
import { readConfig } from "./config";

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
  const opts = readConfig(document.uri);

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
  const docText = buildGoogleDocstringText(sig, bodyIndent, opts.quoteChar, {
    isGenerator,
    ...opts,
  });

  const edit = insertionEdit(document, sigEndLine, docText);
  await vscode.workspace.applyEdit(edit);
}

// ---------------------------------------------------------------------------
// generateFile — insert docstrings for all undocumented defs/classes
// ---------------------------------------------------------------------------

export async function generateFile(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;
  const lines = docLines(document);
  const opts = readConfig(document.uri);
  const insertions = generateFileInsertions(lines, opts);

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

// ---------------------------------------------------------------------------
// update — merge current signature into the existing docstring at cursor
// ---------------------------------------------------------------------------

export async function update(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;
  const cursorLine = editor.selection.active.line;
  const lines = docLines(document);
  const opts = readConfig(document.uri);

  const found = findSignatureFromLines(lines, cursorLine);
  if (!found) {
    vscode.window.showInformationMessage("No function or class found at cursor.");
    return;
  }

  const isGenerator = isGeneratorFunction(lines, found.defLine, found.defLine + 1);
  const result = buildUpdateText(lines, found.defLine, {
    isGenerator,
    returnsMode: opts.returnsMode,
    descPlaceholder: opts.descPlaceholder,
    includeTypes: opts.includeTypes,
  });

  if (!result) {
    vscode.window.showInformationMessage("No docstring found to update.");
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  const range = new vscode.Range(
    new vscode.Position(result.startLine, 0),
    new vscode.Position(result.endLine, document.lineAt(result.endLine).text.length),
  );
  edit.replace(document.uri, range, result.text);
  await vscode.workspace.applyEdit(edit);
}

// ---------------------------------------------------------------------------
// updateFile — apply update to every documented function in the file
// ---------------------------------------------------------------------------

export async function updateFile(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;
  const lines = docLines(document);
  const opts = readConfig(document.uri);
  const edit = new vscode.WorkspaceEdit();
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const found = findSignatureFromLines(lines, i);
    if (!found || found.defLine !== i) continue;

    const isGenerator = isGeneratorFunction(lines, found.defLine, found.defLine + 1);
    const result = buildUpdateText(lines, i, {
      isGenerator,
      returnsMode: opts.returnsMode,
      descPlaceholder: opts.descPlaceholder,
      includeTypes: opts.includeTypes,
    });
    if (!result) continue;

    const range = new vscode.Range(
      new vscode.Position(result.startLine, 0),
      new vscode.Position(result.endLine, document.lineAt(result.endLine).text.length),
    );
    edit.replace(document.uri, range, result.text);
    count++;
  }

  if (count === 0) {
    vscode.window.showInformationMessage("No documented functions found to update.");
    return;
  }

  await vscode.workspace.applyEdit(edit);
}

// ---------------------------------------------------------------------------
// convert — re-render the docstring at cursor in normalised Google style
// ---------------------------------------------------------------------------

export async function convert(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;
  const cursorLine = editor.selection.active.line;
  const lines = docLines(document);

  // Find the docstring opening on or near the cursor line
  let docOpenLine = -1;
  for (let i = cursorLine; i >= Math.max(0, cursorLine - 10); i--) {
    const t = lines[i].trim();
    if (t.startsWith('"""') || t.startsWith("'''")) {
      docOpenLine = i;
      break;
    }
  }
  if (docOpenLine === -1) {
    vscode.window.showInformationMessage("No docstring found at cursor.");
    return;
  }

  const parseResult = parseGoogleDocstring(lines, docOpenLine);
  if (!parseResult) {
    vscode.window.showInformationMessage("Could not parse docstring.");
    return;
  }

  const rendered = renderGoogleDocstring(
    parseResult.parsed,
    parseResult.indent,
    parseResult.quoteChar,
  );

  const edit = new vscode.WorkspaceEdit();
  const range = new vscode.Range(
    new vscode.Position(parseResult.startLine, 0),
    new vscode.Position(parseResult.endLine, document.lineAt(parseResult.endLine).text.length),
  );
  edit.replace(document.uri, range, rendered);
  await vscode.workspace.applyEdit(edit);
}

// ---------------------------------------------------------------------------
// convertFileFormat — apply convert to every docstring in the file
// ---------------------------------------------------------------------------

export async function convertFileFormat(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;
  const lines = docLines(document);
  const edit = new vscode.WorkspaceEdit();
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith('"""') && !t.startsWith("'''")) continue;

    const parseResult = parseGoogleDocstring(lines, i);
    if (!parseResult) continue;

    const rendered = renderGoogleDocstring(
      parseResult.parsed,
      parseResult.indent,
      parseResult.quoteChar,
    );

    const range = new vscode.Range(
      new vscode.Position(parseResult.startLine, 0),
      new vscode.Position(parseResult.endLine, document.lineAt(parseResult.endLine).text.length),
    );
    edit.replace(document.uri, range, rendered);
    // Skip ahead past the docstring we just processed
    i = parseResult.endLine;
    count++;
  }

  if (count === 0) {
    vscode.window.showInformationMessage("No docstrings found in file.");
    return;
  }

  await vscode.workspace.applyEdit(edit);
}
