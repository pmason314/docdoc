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
var vscode5 = __toESM(require("vscode"));

// src/codeAction.ts
var vscode = __toESM(require("vscode"));

// src/docstringParser.ts
function firstColonOutsideBrackets(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === ":" && depth === 0) return i;
  }
  return -1;
}
function parseEntryLine(trimmed) {
  const withParen = /^(\*{0,2}[\w]+)\s+\(([^)]+)\)\s*:\s*(.*)$/.exec(trimmed);
  if (withParen) {
    return { name: withParen[1], typehint: withParen[2], description: withParen[3] };
  }
  const colonIdx = firstColonOutsideBrackets(trimmed);
  if (colonIdx !== -1) {
    return {
      name: trimmed.slice(0, colonIdx).trim(),
      typehint: null,
      description: trimmed.slice(colonIdx + 1).trim()
    };
  }
  return { name: trimmed, typehint: null, description: "" };
}
function parseSectionEntries(sectionLines, entryIndent) {
  const results = [];
  let current = null;
  for (const raw of sectionLines) {
    const line = raw.trimEnd();
    if (line.trim() === "") continue;
    const leadingWS = line.length - line.trimStart().length;
    if (leadingWS <= entryIndent.length) {
      if (current) results.push(current);
      current = parseEntryLine(line.trimStart());
    } else if (current !== null) {
      const cont = line.trimStart();
      current.description = current.description ? `${current.description}
${cont}` : cont;
    }
  }
  if (current) results.push(current);
  return results;
}
function emptyDocstring(summary) {
  return {
    summary,
    extendedSummary: "",
    params: [],
    returns: null,
    yields: null,
    raises: [],
    unknownSections: []
  };
}
function parseGoogleDocstring(lines, openingLine) {
  const line0 = lines[openingLine];
  const openMatch = /^(\s*)("""|''')(.*)$/.exec(line0);
  if (!openMatch) return null;
  const [, indent, quoteChar, restRaw] = openMatch;
  const rest = restRaw.trimEnd();
  const entryIndent = indent + "    ";
  if (rest.endsWith(quoteChar)) {
    const summary2 = rest.slice(0, -quoteChar.length).trim();
    return {
      startLine: openingLine,
      endLine: openingLine,
      indent,
      quoteChar,
      parsed: emptyDocstring(summary2)
    };
  }
  let endLine = -1;
  for (let i = openingLine + 1; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith(quoteChar)) {
      endLine = i;
      break;
    }
  }
  if (endLine === -1) return null;
  let summary = rest.trim();
  let bodyStart = openingLine + 1;
  if (!summary) {
    while (bodyStart < endLine && lines[bodyStart].trim() === "") bodyStart++;
    if (bodyStart < endLine) {
      summary = lines[bodyStart].trim();
      bodyStart++;
    }
  }
  const rawSections = [];
  const extendedLines = [];
  let currentSection = null;
  for (let i = bodyStart; i < endLine; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (line.trim() === "") {
      if (currentSection) currentSection.lines.push("");
      else extendedLines.push("");
      continue;
    }
    const leadingWS = line.length - line.trimStart().length;
    const content = line.trimStart();
    if (leadingWS === indent.length && content.endsWith(":")) {
      currentSection = { header: content.slice(0, -1), lines: [] };
      rawSections.push(currentSection);
    } else if (currentSection) {
      currentSection.lines.push(raw);
    } else {
      extendedLines.push(line);
    }
  }
  const parsed = {
    ...emptyDocstring(summary),
    extendedSummary: extendedLines.join("\n").replace(/^\n+|\n+$/g, "")
  };
  for (const section of rawSections) {
    const entries = parseSectionEntries(section.lines, entryIndent);
    switch (section.header) {
      case "Args":
      case "Arguments":
      case "Parameters":
        parsed.params = entries.map((e) => ({
          name: e.name,
          typehint: e.typehint,
          description: e.description
        }));
        break;
      case "Returns":
      case "Return":
        if (entries.length > 0) {
          parsed.returns = {
            typehint: entries[0].typehint ?? entries[0].name,
            description: entries[0].description
          };
        }
        break;
      case "Yields":
      case "Yield":
        if (entries.length > 0) {
          parsed.yields = {
            typehint: entries[0].typehint ?? entries[0].name,
            description: entries[0].description
          };
        }
        break;
      case "Raises":
        parsed.raises = entries.map((e) => ({
          exception: e.name,
          description: e.description
        }));
        break;
      default:
        parsed.unknownSections.push({ header: section.header, lines: section.lines });
        break;
    }
  }
  return { startLine: openingLine, endLine, indent, quoteChar, parsed };
}

// src/parser.ts
var DEF_RE = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(.+?)\s*)?:\s*$/;
var CLASS_RE = /^(\s*)class\s+(\w+)/;
var DECORATOR_RE = /^\s*@/;
var DEFAULT_OPTIONS = {
  quoteChar: '"""',
  includeTypes: true,
  includeDefaults: true,
  returnsMode: "when-annotated",
  summaryPlaceholder: "_summary_",
  descPlaceholder: "_description_",
  generateModuleDocstring: false
};
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
  let eqIdx = -1;
  {
    let d = 0;
    for (let i = 0; i < withoutLeadingStars.length; i++) {
      const c = withoutLeadingStars[i];
      if (c === "(" || c === "[" || c === "{") d++;
      else if (c === ")" || c === "]" || c === "}") d--;
      else if (c === "=" && d === 0) {
        eqIdx = i;
        break;
      }
    }
  }
  const hasDefault = eqIdx !== -1;
  const defaultValue = hasDefault ? withoutLeadingStars.slice(eqIdx + 1).trim() : void 0;
  const beforeEq = hasDefault ? withoutLeadingStars.slice(0, eqIdx).trim() : withoutLeadingStars.trim();
  const colonIdx = beforeEq.indexOf(":");
  if (colonIdx !== -1) {
    const p2 = {
      name: stars + beforeEq.slice(0, colonIdx).trim(),
      annotation: beforeEq.slice(colonIdx + 1).trim(),
      hasDefault
    };
    if (defaultValue !== void 0) p2.defaultValue = defaultValue;
    return p2;
  }
  const p = { name: stars + beforeEq.trim(), annotation: null, hasDefault };
  if (defaultValue !== void 0) p.defaultValue = defaultValue;
  return p;
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
function shouldSkipReturn(sig, mode) {
  if (sig.kind !== "def") return true;
  switch (mode) {
    case "always":
      return false;
    case "non-none":
      return sig.returnAnnotation === "None";
    case "when-annotated":
    default:
      return sig.returnAnnotation === null || sig.returnAnnotation === "None";
  }
}
function buildGoogleDocstring(sig, _indent, quoteChar, opts = {}) {
  const {
    includeTypes = DEFAULT_OPTIONS.includeTypes,
    includeDefaults = DEFAULT_OPTIONS.includeDefaults,
    returnsMode = DEFAULT_OPTIONS.returnsMode,
    summaryPlaceholder = DEFAULT_OPTIONS.summaryPlaceholder,
    descPlaceholder = DEFAULT_OPTIONS.descPlaceholder,
    isGenerator = false
  } = opts;
  const paramIndent = "    ";
  let n = 1;
  let out = `\${${n++}:${summaryPlaceholder}}`;
  if (sig.kind === "def" && sig.params.length > 0) {
    out += `

Args:
`;
    for (const p of sig.params) {
      const typeHint = includeTypes && p.annotation ? ` (${p.annotation})` : "";
      const defaultsNote = includeDefaults && p.defaultValue ? ` Defaults to ${p.defaultValue}.` : "";
      out += `${paramIndent}${p.name}${typeHint}: \${${n++}:${descPlaceholder}}${defaultsNote}
`;
    }
  }
  if (!shouldSkipReturn(sig, returnsMode)) {
    const sectionLabel = isGenerator ? "Yields" : "Returns";
    const sectionPrefix = out.endsWith("\n") ? "\n" : "\n\n";
    out += `${sectionPrefix}${sectionLabel}:
`;
    const typePrefix = sig.returnAnnotation && sig.returnAnnotation !== "None" ? `${sig.returnAnnotation}: ` : "";
    out += `${paramIndent}${typePrefix}\${${n++}:${descPlaceholder}}
`;
  }
  out += quoteChar;
  return out.replace(/^[ \t]+$/gm, "");
}
function buildGoogleDocstringText(sig, indent, quoteChar, opts = {}) {
  const {
    includeTypes = DEFAULT_OPTIONS.includeTypes,
    includeDefaults = DEFAULT_OPTIONS.includeDefaults,
    returnsMode = DEFAULT_OPTIONS.returnsMode,
    summaryPlaceholder = DEFAULT_OPTIONS.summaryPlaceholder,
    descPlaceholder = DEFAULT_OPTIONS.descPlaceholder,
    isGenerator = false
  } = opts;
  const paramIndent = indent + "    ";
  let out = `${indent}${quoteChar}${summaryPlaceholder}`;
  if (sig.kind === "def" && sig.params.length > 0) {
    out += `

${indent}Args:
`;
    for (const p of sig.params) {
      const typeHint = includeTypes && p.annotation ? ` (${p.annotation})` : "";
      const defaultsNote = includeDefaults && p.defaultValue ? ` Defaults to ${p.defaultValue}.` : "";
      out += `${paramIndent}${p.name}${typeHint}: ${descPlaceholder}${defaultsNote}
`;
    }
  }
  if (!shouldSkipReturn(sig, returnsMode)) {
    const sectionLabel = isGenerator ? "Yields" : "Returns";
    const sectionPrefix = out.endsWith("\n") ? "\n" : "\n\n";
    out += `${sectionPrefix}${indent}${sectionLabel}:
`;
    const typePrefix = sig.returnAnnotation && sig.returnAnnotation !== "None" ? `${sig.returnAnnotation}: ` : "";
    out += `${paramIndent}${typePrefix}${descPlaceholder}
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
function generateFileInsertions(lines, opts = {}) {
  const insertions = [];
  const quoteChar = opts.quoteChar ?? DEFAULT_OPTIONS.quoteChar;
  const summaryPh = opts.summaryPlaceholder ?? DEFAULT_OPTIONS.summaryPlaceholder;
  if (opts.generateModuleDocstring) {
    const hasModuleDoc = (() => {
      for (const line of lines) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        return t.startsWith('"""') || t.startsWith("'''");
      }
      return false;
    })();
    if (!hasModuleDoc) {
      insertions.push({ afterLine: -1, text: `${quoteChar}${summaryPh}${quoteChar}` });
    }
  }
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
    const docText = buildGoogleDocstringText(found.sig, bodyIndent, quoteChar, {
      isGenerator,
      ...opts
    });
    insertions.push({ afterLine: sigEndLine, text: docText });
  }
  return insertions;
}
function mergeDocstring(sig, existing, opts = {}) {
  const {
    isGenerator = false,
    returnsMode = DEFAULT_OPTIONS.returnsMode,
    descPlaceholder = DEFAULT_OPTIONS.descPlaceholder
  } = opts;
  const existingByName = new Map(existing.params.map((p) => [p.name, p]));
  const newParams = sig.params.map((p) => {
    const found = existingByName.get(p.name);
    return {
      name: p.name,
      typehint: p.annotation ?? null,
      description: found?.description ?? descPlaceholder
    };
  });
  const skipReturn = shouldSkipReturn(sig, returnsMode);
  let newReturns = null;
  let newYields = null;
  if (!skipReturn) {
    const existingDesc = (isGenerator ? existing.yields?.description : existing.returns?.description) ?? existing.returns?.description ?? existing.yields?.description ?? descPlaceholder;
    if (isGenerator) {
      newYields = { typehint: sig.returnAnnotation, description: existingDesc };
    } else {
      newReturns = { typehint: sig.returnAnnotation, description: existingDesc };
    }
  }
  return {
    summary: existing.summary,
    extendedSummary: existing.extendedSummary,
    params: newParams,
    returns: newReturns,
    yields: newYields,
    raises: existing.raises,
    unknownSections: existing.unknownSections
  };
}
function renderGoogleDocstring(parsed, indent, quoteChar) {
  const paramIndent = indent + "    ";
  const contIndent = paramIndent + "    ";
  function renderDesc(firstPrefix, desc) {
    const lines = desc.split("\n");
    let s = `${firstPrefix}${lines[0]}
`;
    for (let i = 1; i < lines.length; i++) s += `${contIndent}${lines[i]}
`;
    return s;
  }
  const hasContent = parsed.params.length > 0 || parsed.returns !== null || parsed.yields !== null || parsed.raises.length > 0 || parsed.unknownSections.length > 0 || parsed.extendedSummary !== "";
  if (!hasContent) {
    return `${indent}${quoteChar}${parsed.summary}${quoteChar}`;
  }
  let out = `${indent}${quoteChar}${parsed.summary}
`;
  if (parsed.extendedSummary) {
    out += `
${parsed.extendedSummary}
`;
  }
  if (parsed.params.length > 0) {
    out += `
${indent}Args:
`;
    for (const p of parsed.params) {
      const typeHint = p.typehint ? ` (${p.typehint})` : "";
      out += renderDesc(`${paramIndent}${p.name}${typeHint}: `, p.description);
    }
  }
  const returnsEntry = parsed.yields ?? parsed.returns;
  if (returnsEntry) {
    const label = parsed.yields !== null ? "Yields" : "Returns";
    out += `
${indent}${label}:
`;
    const typePrefix = returnsEntry.typehint ? `${returnsEntry.typehint}: ` : "";
    out += renderDesc(`${paramIndent}${typePrefix}`, returnsEntry.description);
  }
  if (parsed.raises.length > 0) {
    out += `
${indent}Raises:
`;
    for (const r of parsed.raises) {
      out += renderDesc(`${paramIndent}${r.exception}: `, r.description);
    }
  }
  for (const section of parsed.unknownSections) {
    out += `
${indent}${section.header}:
`;
    for (const l of section.lines) out += `${l}
`;
  }
  out += `${indent}${quoteChar}`;
  return out;
}
function buildUpdateText(lines, defLine, opts = {}) {
  const found = findSignatureFromLines(lines, defLine);
  if (!found) return null;
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
  let docOpenLine = -1;
  for (let i = sigEndLine + 1; i < Math.min(lines.length, sigEndLine + 6); i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) docOpenLine = i;
    break;
  }
  if (docOpenLine === -1) return null;
  const parseResult = parseGoogleDocstring(lines, docOpenLine);
  if (!parseResult) return null;
  const merged = mergeDocstring(found.sig, parseResult.parsed, opts);
  const text = renderGoogleDocstring(merged, parseResult.indent, parseResult.quoteChar);
  return { text, startLine: parseResult.startLine, endLine: parseResult.endLine };
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
  const opts = (void 0)(document.uri);
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
  const docText = buildGoogleDocstringText(sig, bodyIndent, opts.quoteChar, {
    isGenerator,
    ...opts
  });
  const edit = insertionEdit(document, sigEndLine, docText);
  await vscode2.workspace.applyEdit(edit);
}
async function generateFile(editor) {
  const document = editor.document;
  const lines = docLines(document);
  const opts = (void 0)(document.uri);
  const insertions = generateFileInsertions(lines, opts);
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
async function update(editor) {
  const document = editor.document;
  const cursorLine = editor.selection.active.line;
  const lines = docLines(document);
  const opts = (void 0)(document.uri);
  const found = findSignatureFromLines(lines, cursorLine);
  if (!found) {
    vscode2.window.showInformationMessage("No function or class found at cursor.");
    return;
  }
  const isGenerator = isGeneratorFunction(lines, found.defLine, found.defLine + 1);
  const result = buildUpdateText(lines, found.defLine, {
    isGenerator,
    returnsMode: opts.returnsMode,
    descPlaceholder: opts.descPlaceholder
  });
  if (!result) {
    vscode2.window.showInformationMessage("No docstring found to update.");
    return;
  }
  const edit = new vscode2.WorkspaceEdit();
  const range = new vscode2.Range(
    new vscode2.Position(result.startLine, 0),
    new vscode2.Position(result.endLine, document.lineAt(result.endLine).text.length)
  );
  edit.replace(document.uri, range, result.text);
  await vscode2.workspace.applyEdit(edit);
}
async function updateFile(editor) {
  const document = editor.document;
  const lines = docLines(document);
  const opts = (void 0)(document.uri);
  const edit = new vscode2.WorkspaceEdit();
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const found = findSignatureFromLines(lines, i);
    if (!found || found.defLine !== i) continue;
    const isGenerator = isGeneratorFunction(lines, found.defLine, found.defLine + 1);
    const result = buildUpdateText(lines, i, {
      isGenerator,
      returnsMode: opts.returnsMode,
      descPlaceholder: opts.descPlaceholder
    });
    if (!result) continue;
    const range = new vscode2.Range(
      new vscode2.Position(result.startLine, 0),
      new vscode2.Position(result.endLine, document.lineAt(result.endLine).text.length)
    );
    edit.replace(document.uri, range, result.text);
    count++;
  }
  if (count === 0) {
    vscode2.window.showInformationMessage("No documented functions found to update.");
    return;
  }
  await vscode2.workspace.applyEdit(edit);
}
async function convert(editor) {
  const document = editor.document;
  const cursorLine = editor.selection.active.line;
  const lines = docLines(document);
  let docOpenLine = -1;
  for (let i = cursorLine; i >= Math.max(0, cursorLine - 10); i--) {
    const t = lines[i].trim();
    if (t.startsWith('"""') || t.startsWith("'''")) {
      docOpenLine = i;
      break;
    }
  }
  if (docOpenLine === -1) {
    vscode2.window.showInformationMessage("No docstring found at cursor.");
    return;
  }
  const parseResult = parseGoogleDocstring(lines, docOpenLine);
  if (!parseResult) {
    vscode2.window.showInformationMessage("Could not parse docstring.");
    return;
  }
  const rendered = renderGoogleDocstring(
    parseResult.parsed,
    parseResult.indent,
    parseResult.quoteChar
  );
  const edit = new vscode2.WorkspaceEdit();
  const range = new vscode2.Range(
    new vscode2.Position(parseResult.startLine, 0),
    new vscode2.Position(parseResult.endLine, document.lineAt(parseResult.endLine).text.length)
  );
  edit.replace(document.uri, range, rendered);
  await vscode2.workspace.applyEdit(edit);
}
async function convertFileFormat(editor) {
  const document = editor.document;
  const lines = docLines(document);
  const edit = new vscode2.WorkspaceEdit();
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith('"""') && !t.startsWith("'''")) continue;
    const parseResult = parseGoogleDocstring(lines, i);
    if (!parseResult) continue;
    const rendered = renderGoogleDocstring(
      parseResult.parsed,
      parseResult.indent,
      parseResult.quoteChar
    );
    const range = new vscode2.Range(
      new vscode2.Position(parseResult.startLine, 0),
      new vscode2.Position(parseResult.endLine, document.lineAt(parseResult.endLine).text.length)
    );
    edit.replace(document.uri, range, rendered);
    i = parseResult.endLine;
    count++;
  }
  if (count === 0) {
    vscode2.window.showInformationMessage("No docstrings found in file.");
    return;
  }
  await vscode2.workspace.applyEdit(edit);
}

// src/onSave.ts
var vscode3 = __toESM(require("vscode"));
function registerOnSaveHandler(context) {
  context.subscriptions.push(
    vscode3.workspace.onDidSaveTextDocument(async (document) => {
      if (document.languageId !== "python") return;
      const enabled = vscode3.workspace.getConfiguration("docstringGenerator").get("onSave.enable", false);
      if (!enabled) return;
      const lines = Array.from({ length: document.lineCount }, (_, i) => document.lineAt(i).text);
      const insertions = generateFileInsertions(lines);
      if (insertions.length === 0) return;
      const edit = new vscode3.WorkspaceEdit();
      for (const ins of insertions) {
        const insertPos = new vscode3.Position(ins.afterLine + 1, 0);
        edit.insert(document.uri, insertPos, ins.text + "\n");
      }
      await vscode3.workspace.applyEdit(edit);
    })
  );
}

// src/trigger.ts
var vscode4 = __toESM(require("vscode"));
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
    let snippetBody;
    if (found) {
      const isGenerator = isGeneratorFunction(lines, found.defLine, position.line + 1);
      snippetBody = buildGoogleDocstring(found.sig, indent, quoteChar, { isGenerator });
    } else if (isModuleLevelLines(lines, position.line - 1)) {
      snippetBody = `\${1:_summary_}
${indent}${quoteChar}`;
    } else {
      return [];
    }
    const bodyLines = snippetBody.split("\n");
    const fullSnippet = indent + quoteChar + bodyLines[0] + "\n" + bodyLines.slice(1).map((l) => l === "" ? "" : indent + l).join("\n");
    const lineStart = new vscode4.Position(position.line, 0);
    const range = new vscode4.Range(lineStart, position.with(void 0, lineText.length));
    return [new vscode4.InlineCompletionItem(new vscode4.SnippetString(fullSnippet), range)];
  }
};

// src/extension.ts
function activate(context) {
  context.subscriptions.push(
    vscode5.languages.registerInlineCompletionItemProvider(
      { language: "python" },
      new DocstringTrigger()
    ),
    vscode5.commands.registerTextEditorCommand("docstringGenerator.generate", generate),
    vscode5.commands.registerTextEditorCommand("docstringGenerator.generateFile", generateFile),
    vscode5.commands.registerTextEditorCommand("docstringGenerator.update", update),
    vscode5.commands.registerTextEditorCommand("docstringGenerator.updateFile", updateFile),
    vscode5.commands.registerTextEditorCommand("docstringGenerator.convertFormat", convert),
    vscode5.commands.registerTextEditorCommand(
      "docstringGenerator.convertFileFormat",
      convertFileFormat
    ),
    vscode5.languages.registerCodeActionsProvider(
      { language: "python" },
      new GenerateDocstringActionProvider(),
      { providedCodeActionKinds: GenerateDocstringActionProvider.providedKinds }
    )
  );
  registerOnSaveHandler(context);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
