"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode4 = __toESM(require("vscode"));

// src/codeAction.ts
var vscode = __toESM(require("vscode"));

// src/parser.ts
var DEF_RE = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(.+?)\s*)?:\s*$/;
var CLASS_RE = /^(\s*)class\s+(\w+)/;
var DECORATOR_RE = /^\s*@/;
function splitParams(raw) {
  const result = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    if (ch === "," && depth === 0) {
      const trimmed2 = current.trim();
      if (trimmed2) result.push(trimmed2);
      current = "";
    } else {
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") depth--;
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) result.push(trimmed);
  return result;
}
function parseParam(token) {
  const starsMatch = token.match(/^(\*{1,2})/);
  const stars = starsMatch ? starsMatch[1] : "";
  const withoutLeadingStars = token.slice(stars.length);
  if (!withoutLeadingStars.trim()) return null;
  const eqIdx = withoutLeadingStars.indexOf("=");
  const hasDefault = eqIdx !== -1;
  const beforeEq = hasDefault ? withoutLeadingStars.slice(0, eqIdx).trim() : withoutLeadingStars.trim();
  const colonIdx = beforeEq.indexOf(":");
  if (colonIdx !== -1) {
    return {
      name: stars + beforeEq.slice(0, colonIdx).trim(),
      annotation: beforeEq.slice(colonIdx + 1).trim(),
      hasDefault
    };
  }
  return { name: stars + beforeEq.trim(), annotation: null, hasDefault };
}
function buildSigFromMatch(match) {
  const rawParams = match[3] ?? "";
  const returnStr = match[4] ?? null;
  const params = [];
  for (const token of splitParams(rawParams)) {
    const p = parseParam(token);
    if (!p) continue;
    if (p.name === "self" || p.name === "cls") continue;
    params.push(p);
  }
  return { kind: "def", name: match[2], params, returnAnnotation: returnStr };
}
function assembleMultiLineSig(lines, closingLine, limit) {
  let depth = 0;
  const parts = [];
  for (let i = closingLine; i >= limit; i--) {
    const text = lines[i];
    parts.unshift(text.trim());
    for (const ch of text) {
      if (ch === ")" || ch === "]" || ch === "}") depth++;
      else if (ch === "(" || ch === "[" || ch === "{") depth--;
    }
    if (depth <= 0 && /(?:async\s+)?def\s/.test(text)) {
      const joined = parts.join(" ");
      const parenStartIdx = joined.search(/(?:async\s+)?def\s+\w+\s*\(/);
      if (parenStartIdx === -1) return null;
      const parenStart = joined.indexOf("(", parenStartIdx);
      let d = 0;
      let closeIdx = -1;
      for (let j = parenStart; j < joined.length; j++) {
        if (joined[j] === "(") d++;
        else if (joined[j] === ")") {
          d--;
          if (d === 0) {
            closeIdx = j;
            break;
          }
        }
      }
      if (closeIdx === -1) return null;
      const rawParams = joined.slice(parenStart + 1, closeIdx);
      const afterClose = joined.slice(closeIdx + 1).trim();
      const returnMatch = /^->\s*(.+?)\s*:/.exec(afterClose);
      const returnAnnotation = returnMatch ? returnMatch[1].trim() : null;
      const nameMatch = /(?:async\s+)?def\s+(\w+)/.exec(joined);
      if (!nameMatch) return null;
      const params = [];
      for (const token of splitParams(rawParams)) {
        const p = parseParam(token);
        if (!p) continue;
        if (p.name === "self" || p.name === "cls") continue;
        params.push(p);
      }
      return {
        sig: { kind: "def", name: nameMatch[1], params, returnAnnotation },
        defLine: i
      };
    }
    if (depth < 0) return null;
  }
  return null;
}
function findSignatureFromLines(lines, startLine) {
  const limit = Math.max(0, startLine - 30);
  for (let i = startLine; i >= limit; i--) {
    const text = lines[i];
    const trimmed = text.trim();
    const defMatch = DEF_RE.exec(text);
    if (defMatch) {
      return { sig: buildSigFromMatch(defMatch), defLine: i };
    }
    const classMatch = CLASS_RE.exec(text);
    if (classMatch) {
      return {
        sig: { kind: "class", name: classMatch[2], params: [], returnAnnotation: null },
        defLine: i
      };
    }
    if (trimmed === "" || DECORATOR_RE.test(text)) continue;
    if (trimmed.endsWith(":") && trimmed.includes(")")) {
      const assembled = assembleMultiLineSig(lines, i, limit);
      if (assembled) return assembled;
    }
    break;
  }
  return null;
}
function isModuleLevelLines(lines, startLine) {
  for (let i = startLine; i >= 0; i--) {
    const text = lines[i].trim();
    if (text === "" || text.startsWith("#")) continue;
    return false;
  }
  return true;
}
function isGeneratorFunction(lines, defLine, bodyStartLine) {
  const defText = lines[defLine] ?? "";
  const defIndent = (defText.match(/^(\s*)/) ?? ["", ""])[1].length;
  for (let i = bodyStartLine; i < lines.length && i < bodyStartLine + 200; i++) {
    const text = lines[i];
    const trimmed = text.trim();
    if (!trimmed) continue;
    const lineIndent = (text.match(/^(\s*)/) ?? ["", ""])[1].length;
    if (lineIndent <= defIndent) break;
    if (/\byield\b/.test(trimmed)) return true;
  }
  return false;
}
function buildGoogleDocstring(sig, indent, quoteChar, opts = {}) {
  const paramIndent = indent + "    ";
  let n = 1;
  let out = `\${${n++}:_summary_}`;
  if (sig.kind === "def" && sig.params.length > 0) {
    out += `

${indent}Args:
`;
    for (const p of sig.params) {
      const typeHint = p.annotation ? ` (${p.annotation})` : "";
      out += `${paramIndent}${p.name}${typeHint}: \${${n++}:_description_}
`;
    }
  }
  const skipReturn = sig.kind !== "def" || sig.returnAnnotation === null || sig.returnAnnotation === "None";
  if (!skipReturn) {
    const sectionLabel = opts.isGenerator ? "Yields" : "Returns";
    out += `
${indent}${sectionLabel}:
`;
    out += `${paramIndent}${sig.returnAnnotation}: \${${n++}:_description_}
`;
  }
  out += out.endsWith("\n") ? `${indent}${quoteChar}` : quoteChar;
  return out;
}
function buildGoogleDocstringText(sig, indent, quoteChar, opts = {}) {
  const paramIndent = indent + "    ";
  let out = `${indent}${quoteChar}_summary_`;
  if (sig.kind === "def" && sig.params.length > 0) {
    out += `

${indent}Args:
`;
    for (const p of sig.params) {
      const typeHint = p.annotation ? ` (${p.annotation})` : "";
      out += `${paramIndent}${p.name}${typeHint}: _description_
`;
    }
  }
  const skipReturn = sig.kind !== "def" || sig.returnAnnotation === null || sig.returnAnnotation === "None";
  if (!skipReturn) {
    const sectionLabel = opts.isGenerator ? "Yields" : "Returns";
    out += `
${indent}${sectionLabel}:
`;
    out += `${paramIndent}${sig.returnAnnotation}: _description_
`;
  }
  out += out.endsWith("\n") ? `${indent}${quoteChar}` : quoteChar;
  return out;
}
function hasDocstring(lines, defLine) {
  for (let i = defLine + 1; i < lines.length && i <= defLine + 5; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    return trimmed.startsWith('"""') || trimmed.startsWith("'''");
  }
  return false;
}
function generateFileInsertions(lines, quoteChar = '"""') {
  const insertions = [];
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const isDefOrClass = DEF_RE.test(text) || CLASS_RE.test(text);
    if (!isDefOrClass) continue;
    let sigEndLine = i;
    if (!text.trimEnd().endsWith(":")) {
      let depth = 0;
      for (const ch of text) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      let j = i + 1;
      while (j < lines.length && depth > 0) {
        for (const ch of lines[j]) {
          if (ch === "(") depth++;
          else if (ch === ")") depth--;
        }
        j++;
      }
      sigEndLine = j - 1;
    }
    if (hasDocstring(lines, sigEndLine)) continue;
    const found = findSignatureFromLines(lines, sigEndLine);
    if (!found) continue;
    const defIndent = (text.match(/^(\s*)/) ?? ["", ""])[1];
    const bodyIndent = defIndent + "    ";
    const isGenerator = isGeneratorFunction(lines, found.defLine, sigEndLine + 1);
    const docText = buildGoogleDocstringText(found.sig, bodyIndent, quoteChar, { isGenerator });
    insertions.push({ afterLine: sigEndLine, text: docText });
  }
  return insertions;
}

// src/codeAction.ts
var GenerateDocstringActionProvider = class {
  static {
    this.providedKinds = [vscode.CodeActionKind.QuickFix];
  }
  provideCodeActions(document, range) {
    const actions = [];
    for (let i = range.start.line; i <= range.end.line; i++) {
      const text = document.lineAt(i).text;
      if (!DEF_RE.test(text) && !CLASS_RE.test(text)) continue;
      const lines = Array.from(
        { length: document.lineCount },
        (_, n) => document.lineAt(n).text
      );
      if (hasDocstring(lines, i)) continue;
      const action = new vscode.CodeAction(
        "Generate docstring",
        vscode.CodeActionKind.QuickFix
      );
      action.command = {
        command: "docstringGenerator.generate",
        title: "Generate docstring",
        arguments: [{ line: i }]
      };
      action.isPreferred = true;
      actions.push(action);
    }
    return actions;
  }
};

// src/commands.ts
var vscode2 = __toESM(require("vscode"));
function docLines(document) {
  return Array.from({ length: document.lineCount }, (_, i) => document.lineAt(i).text);
}
function insertionEdit(document, afterLine, text) {
  const edit = new vscode2.WorkspaceEdit();
  const insertPos = new vscode2.Position(afterLine + 1, 0);
  edit.insert(document.uri, insertPos, text + "\n");
  return edit;
}
async function generate(editor) {
  const document = editor.document;
  const cursorLine = editor.selection.active.line;
  const lines = docLines(document);
  const found = findSignatureFromLines(lines, cursorLine);
  if (!found) {
    vscode2.window.showInformationMessage("No function or class found at cursor.");
    return;
  }
  const { sig, defLine } = found;
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
    vscode2.window.showInformationMessage("Docstring already exists.");
    return;
  }
  const defText = lines[defLine];
  const defIndent = (defText.match(/^(\s*)/) ?? ["", ""])[1];
  const bodyIndent = defIndent + "    ";
  const isGenerator = isGeneratorFunction(lines, defLine, sigEndLine + 1);
  const docText = buildGoogleDocstringText(sig, bodyIndent, '"""', { isGenerator });
  const edit = insertionEdit(document, sigEndLine, docText);
  await vscode2.workspace.applyEdit(edit);
}
async function generateFile(editor) {
  const document = editor.document;
  const lines = docLines(document);
  const insertions = generateFileInsertions(lines);
  if (insertions.length === 0) {
    vscode2.window.showInformationMessage("All functions already have docstrings.");
    return;
  }
  const edit = new vscode2.WorkspaceEdit();
  for (const ins of insertions) {
    const insertPos = new vscode2.Position(ins.afterLine + 1, 0);
    edit.insert(document.uri, insertPos, ins.text + "\n");
  }
  await vscode2.workspace.applyEdit(edit);
}

// src/trigger.ts
var vscode3 = __toESM(require("vscode"));
function docLines2(document) {
  return Array.from({ length: document.lineCount }, (_, i) => document.lineAt(i).text);
}
var DocstringTrigger = class {
  provideInlineCompletionItems(document, position, context, _token) {
    if (context.selectedCompletionInfo) return [];
    const lineText = document.lineAt(position.line).text;
    const textUpToCursor = lineText.slice(0, position.character);
    const tripleQuoteMatch = /^(\s*)("""|''')$/.exec(textUpToCursor);
    if (!tripleQuoteMatch) return [];
    const indent = tripleQuoteMatch[1];
    const quoteChar = tripleQuoteMatch[2];
    const lines = docLines2(document);
    const found = findSignatureFromLines(lines, position.line - 1);
    let snippetValue;
    if (found) {
      const isGenerator = isGeneratorFunction(lines, found.defLine, position.line + 1);
      snippetValue = buildGoogleDocstring(found.sig, indent, quoteChar, { isGenerator });
    } else if (isModuleLevelLines(lines, position.line - 1)) {
      snippetValue = `\${1:_summary_}
${indent}${quoteChar}`;
    } else {
      return [];
    }
    const range = new vscode3.Range(position, position.with(void 0, lineText.length));
    return [new vscode3.InlineCompletionItem(new vscode3.SnippetString(snippetValue), range)];
  }
};

// src/extension.ts
function activate(context) {
  context.subscriptions.push(
    vscode4.languages.registerInlineCompletionItemProvider(
      { language: "python" },
      new DocstringTrigger()
    ),
    vscode4.commands.registerTextEditorCommand("docstringGenerator.generate", generate),
    vscode4.commands.registerTextEditorCommand("docstringGenerator.generateFile", generateFile),
    vscode4.languages.registerCodeActionsProvider(
      { language: "python" },
      new GenerateDocstringActionProvider(),
      { providedCodeActionKinds: GenerateDocstringActionProvider.providedKinds }
    )
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
