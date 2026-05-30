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
var vscode2 = __toESM(require("vscode"));

// src/trigger.ts
var vscode = __toESM(require("vscode"));
var DEF_RE = /^(\s*)def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(.+?)\s*)?:\s*$/;
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
  const strippedToken = token.replace(/^\*{1,2}/, "");
  if (!strippedToken) return null;
  const eqIdx = token.indexOf("=");
  const hasDefault = eqIdx !== -1;
  const beforeEq = hasDefault ? token.slice(0, eqIdx).trim() : token.trim();
  const withoutStars = beforeEq.replace(/^\*{1,2}/, "");
  const colonIdx = withoutStars.indexOf(":");
  if (colonIdx !== -1) {
    return {
      name: withoutStars.slice(0, colonIdx).trim(),
      annotation: withoutStars.slice(colonIdx + 1).trim(),
      hasDefault
    };
  }
  return { name: withoutStars.trim(), annotation: null, hasDefault };
}
function isModuleLevel(document, startLine) {
  for (let i = startLine; i >= 0; i--) {
    const text = document.lineAt(i).text.trim();
    if (text === "" || text.startsWith("#")) continue;
    return false;
  }
  return true;
}
function findSignature(document, startLine) {
  for (let i = startLine; i >= 0 && i >= startLine - 30; i--) {
    const text = document.lineAt(i).text;
    const defMatch = DEF_RE.exec(text);
    if (defMatch) {
      const rawParams = defMatch[3] ?? "";
      const returnStr = defMatch[4] ?? null;
      const params = [];
      for (const token of splitParams(rawParams)) {
        const p = parseParam(token);
        if (!p) continue;
        if (p.name === "self" || p.name === "cls") continue;
        params.push(p);
      }
      return {
        kind: "def",
        name: defMatch[2],
        params,
        returnAnnotation: returnStr
      };
    }
    const classMatch = CLASS_RE.exec(text);
    if (classMatch) {
      return { kind: "class", name: classMatch[2], params: [], returnAnnotation: null };
    }
    if (text.trim() !== "" && !DECORATOR_RE.test(text)) {
      break;
    }
  }
  return null;
}
function buildSnippet(sig, indent, quoteChar) {
  const inner = indent + "    ";
  const snippet = new vscode.SnippetString();
  let tabStop = 1;
  snippet.appendPlaceholder("_summary_", tabStop++);
  if (sig.kind === "def" && sig.params.length > 0) {
    snippet.appendText("\n\n" + inner + "Args:\n");
    for (const p of sig.params) {
      const typeHint = p.annotation ? ` (${p.annotation})` : "";
      snippet.appendText(inner + "    " + p.name + typeHint + ": ");
      snippet.appendPlaceholder("_description_", tabStop++);
      snippet.appendText("\n");
    }
  }
  const skipReturn = sig.kind !== "def" || sig.returnAnnotation === null || sig.returnAnnotation === "None";
  if (!skipReturn) {
    snippet.appendText("\n" + inner + "Returns:\n");
    snippet.appendText(inner + "    " + sig.returnAnnotation + ": ");
    snippet.appendPlaceholder("_description_", tabStop++);
    snippet.appendText("\n");
  }
  snippet.appendText(indent + quoteChar);
  return snippet;
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
    const sig = findSignature(document, position.line - 1);
    let snippet;
    if (sig) {
      snippet = buildSnippet(sig, indent, quoteChar);
    } else if (isModuleLevel(document, position.line - 1)) {
      snippet = new vscode.SnippetString();
      snippet.appendPlaceholder("_summary_");
      snippet.appendText("\n" + indent + quoteChar);
    } else {
      return [];
    }
    const range = new vscode.Range(position, position.with(void 0, lineText.length));
    return [new vscode.InlineCompletionItem(snippet, range)];
  }
};

// src/extension.ts
function activate(context) {
  context.subscriptions.push(
    vscode2.languages.registerInlineCompletionItemProvider(
      { language: "python" },
      new DocstringTrigger()
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
