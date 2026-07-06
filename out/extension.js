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
var vscode7 = __toESM(require("vscode"));

// src/builder/google.ts
function buildGoogleText(sig, indent, cfg) {
  return buildGoogleLines(sig, indent, cfg, false).join("\n");
}
function buildGoogleSnippet(sig, indent, cfg) {
  return buildGoogleLines(sig, indent, cfg, true).join("\n");
}
function buildGoogleLines(sig, indent, cfg, snippet) {
  const q = cfg.quoteStyle === "single" ? "'''" : '"""';
  let tabStop = 1;
  const ph = (text) => snippet ? `\${${tabStop++}:${text}}` : text;
  if (sig.kind === "class") {
    return [`${indent}${q}${ph(cfg.placeholderSummary)}.${q}`];
  }
  const summaryPh = ph(cfg.placeholderSummary);
  const argLines = buildArgsLines(sig.params, indent, cfg, ph);
  const retLines = buildReturnsLines(sig, indent, cfg, ph);
  const raisesLines = buildRaisesLines(sig.raises, indent, cfg, ph);
  const sections = [argLines, retLines, raisesLines].filter((s) => s.length > 0);
  if (sections.length === 0) {
    return [`${indent}${q}${summaryPh}.${q}`];
  }
  const lines = [];
  lines.push(`${indent}${q}${summaryPh}.`);
  for (const section of sections) {
    lines.push("");
    lines.push(...section);
  }
  lines.push(`${indent}${q}`);
  return lines;
}
function buildArgsLines(params, indent, cfg, ph) {
  if (params.length === 0) return [];
  const lines = [`${indent}Args:`];
  for (const param of params) {
    const displayName = param.kind === "var_positional" ? `*${param.name}` : param.kind === "var_keyword" ? `**${param.name}` : param.name;
    const typePart = cfg.includeTypes && param.type ? ` (${param.type})` : "";
    let desc = ph(cfg.placeholderDescription);
    if (cfg.includeDefaults && param.default !== void 0) {
      desc += `. Defaults to ${param.default}.`;
    }
    lines.push(`${indent}    ${displayName}${typePart}: ${desc}`);
  }
  return lines;
}
function buildReturnsLines(sig, indent, cfg, ph) {
  if (cfg.returnsMode === "auto" && !sig.hasReturnValue && !sig.isGenerator && !(sig.returnType && sig.returnType !== "None"))
    return [];
  const header = sig.isGenerator ? `${indent}Yields:` : `${indent}Returns:`;
  if (sig.returnType === "None") {
    return [header, `${indent}    None`];
  }
  const typePart = sig.returnType ? `${sig.returnType}: ` : "";
  return [header, `${indent}    ${typePart}${ph(cfg.placeholderDescription)}`];
}
function buildRaisesLines(raises, indent, cfg, ph) {
  if (raises.length === 0) return [];
  const lines = [`${indent}Raises:`];
  for (const exc of raises) {
    lines.push(`${indent}    ${exc}: ${ph(cfg.placeholderDescription)}`);
  }
  return lines;
}

// src/builder/numpy.ts
function buildNumpyText(sig, indent, cfg) {
  return buildNumpyLines(sig, indent, cfg, false).join("\n");
}
function buildNumpySnippet(sig, indent, cfg) {
  return buildNumpyLines(sig, indent, cfg, true).join("\n");
}
function buildNumpyLines(sig, indent, cfg, snippet) {
  const q = cfg.quoteStyle === "single" ? "'''" : '"""';
  let tabStop = 1;
  const ph = (text) => snippet ? `\${${tabStop++}:${text}}` : text;
  if (sig.kind === "class") {
    return [`${indent}${q}${ph(cfg.placeholderSummary)}.${q}`];
  }
  const summaryPh = ph(cfg.placeholderSummary);
  const argLines = buildParamsLines(sig.params, indent, cfg, ph);
  const retLines = buildReturnsLines2(sig, indent, cfg, ph);
  const raisesLines = buildRaisesLines2(sig.raises, indent, cfg, ph);
  const sections = [argLines, retLines, raisesLines].filter((s) => s.length > 0);
  if (sections.length === 0) {
    return [`${indent}${q}${summaryPh}.${q}`];
  }
  const lines = [];
  lines.push(`${indent}${q}${summaryPh}.`);
  for (const section of sections) {
    lines.push("");
    lines.push(...section);
  }
  lines.push(`${indent}${q}`);
  return lines;
}
function buildParamsLines(params, indent, cfg, ph) {
  if (params.length === 0) return [];
  const dashes = `${indent}----------`;
  const lines = [`${indent}Parameters`, dashes];
  for (const param of params) {
    const displayName = param.kind === "var_positional" ? `*${param.name}` : param.kind === "var_keyword" ? `**${param.name}` : param.name;
    const typePart = cfg.includeTypes && param.type ? ` : ${param.type}` : "";
    let desc = ph(cfg.placeholderDescription);
    if (cfg.includeDefaults && param.default !== void 0) {
      desc += ` Defaults to ${param.default}.`;
    }
    lines.push(`${indent}${displayName}${typePart}`);
    lines.push(`${indent}    ${desc}`);
  }
  return lines;
}
function buildReturnsLines2(sig, indent, cfg, ph) {
  if (cfg.returnsMode === "auto" && !sig.hasReturnValue && !sig.isGenerator && !(sig.returnType && sig.returnType !== "None"))
    return [];
  const header = sig.isGenerator ? "Yields" : "Returns";
  const dashes = "-".repeat(header.length);
  if (sig.returnType === "None") {
    return [`${indent}${header}`, `${indent}${dashes}`, `${indent}None`];
  }
  const typeLine = sig.returnType ?? "";
  return [
    `${indent}${header}`,
    `${indent}${dashes}`,
    ...typeLine ? [`${indent}${typeLine}`] : [],
    `${indent}    ${ph(cfg.placeholderDescription)}`
  ];
}
function buildRaisesLines2(raises, indent, cfg, ph) {
  if (raises.length === 0) return [];
  const lines = [`${indent}Raises`, `${indent}------`];
  for (const exc of raises) {
    lines.push(`${indent}${exc}`);
    lines.push(`${indent}    ${ph(cfg.placeholderDescription)}`);
  }
  return lines;
}

// src/builder/sphinx.ts
function buildSphinxText(sig, indent, cfg) {
  return buildSphinxLines(sig, indent, cfg, false).join("\n");
}
function buildSphinxSnippet(sig, indent, cfg) {
  return buildSphinxLines(sig, indent, cfg, true).join("\n");
}
function buildSphinxLines(sig, indent, cfg, snippet) {
  const q = cfg.quoteStyle === "single" ? "'''" : '"""';
  let tabStop = 1;
  const ph = (text) => snippet ? `\${${tabStop++}:${text}}` : text;
  if (sig.kind === "class") {
    return [`${indent}${q}${ph(cfg.placeholderSummary)}.${q}`];
  }
  const summaryPh = ph(cfg.placeholderSummary);
  const body = buildSphinxBody(sig, indent, cfg, ph);
  if (body.length === 0) {
    return [`${indent}${q}${summaryPh}.${q}`];
  }
  const lines = [];
  lines.push(`${indent}${q}${summaryPh}.`);
  lines.push("");
  lines.push(...body);
  lines.push(`${indent}${q}`);
  return lines;
}
function buildSphinxBody(sig, indent, cfg, ph) {
  const lines = [];
  for (const param of sig.params) {
    const displayName = param.kind === "var_positional" ? `*${param.name}` : param.kind === "var_keyword" ? `**${param.name}` : param.name;
    let desc = ph(cfg.placeholderDescription);
    if (cfg.includeDefaults && param.default !== void 0) {
      desc += ` Defaults to ${param.default}.`;
    }
    lines.push(`${indent}:param ${displayName}: ${desc}`);
    if (cfg.includeTypes && param.type) {
      lines.push(`${indent}:type ${displayName}: ${param.type}`);
    }
  }
  if (sig.params.length > 0 && (sig.returnType || sig.raises.length > 0)) {
    lines.push("");
  }
  const includeReturns = cfg.returnsMode === "always" || cfg.returnsMode === "auto" && (sig.hasReturnValue || sig.isGenerator || sig.returnType !== void 0 && sig.returnType !== "None");
  if (includeReturns) {
    const retLabel = sig.isGenerator ? "yields" : "returns";
    lines.push(`${indent}:${retLabel}: ${ph(cfg.placeholderDescription)}`);
    if (sig.returnType) {
      const rtypeLabel = sig.isGenerator ? "ytype" : "rtype";
      lines.push(`${indent}:${rtypeLabel}: ${sig.returnType}`);
    }
  }
  for (const exc of sig.raises) {
    lines.push(`${indent}:raises ${exc}: ${ph(cfg.placeholderDescription)}`);
  }
  return lines;
}

// src/builder/index.ts
function buildDocstringText(sig, indent, cfg) {
  switch (cfg.format) {
    case "numpy":
      return buildNumpyText(sig, indent, cfg);
    case "sphinx":
      return buildSphinxText(sig, indent, cfg);
    default:
      return buildGoogleText(sig, indent, cfg);
  }
}
function buildDocstringSnippet(sig, indent, cfg) {
  switch (cfg.format) {
    case "numpy":
      return buildNumpySnippet(sig, indent, cfg);
    case "sphinx":
      return buildSphinxSnippet(sig, indent, cfg);
    default:
      return buildGoogleSnippet(sig, indent, cfg);
  }
}

// src/docstringParser/googleParser.ts
var PARAM_SECTION_NAMES = /* @__PURE__ */ new Set(["args", "arguments", "parameters", "params", "attributes"]);
var RAISES_SECTION_NAMES = /* @__PURE__ */ new Set(["raises", "raise", "except", "exceptions"]);
var RETURNS_SECTION_NAMES = /* @__PURE__ */ new Set(["returns", "return"]);
var YIELDS_SECTION_NAMES = /* @__PURE__ */ new Set(["yields", "yield"]);
function parseGoogleDocstring(docLines, startLine) {
  const firstLine = docLines[0] ?? "";
  const indent = firstLine.match(/^(\s*)/)?.[1] ?? "";
  const quotes = firstLine.trimStart().startsWith("'''") ? "'''" : '"""';
  const inner = normalizeLines(docLines, indent, quotes);
  const summary = inner[0] ?? "";
  const rest = inner.slice(1);
  const { extendedSummary, sections } = splitSections(rest);
  let args = [];
  let returns;
  let yields;
  let raises = [];
  const customSections = [];
  for (const { header, body } of sections) {
    const key = header.replace(/:$/, "").trim().toLowerCase();
    if (PARAM_SECTION_NAMES.has(key)) {
      args = parseParamEntries(body);
    } else if (RETURNS_SECTION_NAMES.has(key)) {
      returns = parseReturnEntry(body);
    } else if (YIELDS_SECTION_NAMES.has(key)) {
      yields = parseReturnEntry(body);
    } else if (RAISES_SECTION_NAMES.has(key)) {
      raises = parseRaisesEntries(body);
    } else {
      customSections.push({ header, contentLines: body });
    }
  }
  return {
    summary,
    extendedSummary,
    args,
    returns,
    yields,
    raises,
    customSections,
    startLine,
    endLine: startLine + docLines.length - 1,
    indent,
    quotes
  };
}
function normalizeLines(docLines, indent, quotes) {
  const result = [];
  for (let i = 0; i < docLines.length; i++) {
    const raw = docLines[i];
    if (i === 0) {
      let stripped = raw.trimStart().slice(quotes.length);
      if (i === docLines.length - 1) {
        if (stripped.endsWith(quotes)) stripped = stripped.slice(0, -quotes.length);
        result.push(stripped);
        continue;
      }
      result.push(stripped);
      continue;
    }
    if (i === docLines.length - 1) {
      continue;
    }
    if (raw.trim() === "") {
      result.push("");
    } else if (raw.startsWith(indent)) {
      result.push(raw.slice(indent.length));
    } else {
      result.push(raw);
    }
  }
  return result;
}
var SECTION_HEADER_RE = /^(\w[\w ]*):$/;
function splitSections(lines) {
  const sections = [];
  let extendedParts = [];
  let current = null;
  for (const line of lines) {
    const isHeader = SECTION_HEADER_RE.test(line);
    if (isHeader && line[0] !== " ") {
      current = { header: line, body: [] };
      sections.push(current);
    } else if (current) {
      if (line.trim() === "") {
        current.body.push("");
      } else if (line.startsWith("    ")) {
        current.body.push(line.slice(4));
      } else {
        current.body.push(line);
      }
    } else {
      extendedParts.push(line);
    }
  }
  while (extendedParts.length > 0 && extendedParts[extendedParts.length - 1].trim() === "") {
    extendedParts.pop();
  }
  return {
    extendedSummary: extendedParts.join("\n"),
    sections
  };
}
var PARAM_ENTRY_RE = /^(\*{0,2}\w+)\s*(?:\(([^)]*)\))?:\s*(.*)/;
function parseParamEntries(body) {
  const params = [];
  let current = null;
  for (const line of body) {
    const m = PARAM_ENTRY_RE.exec(line);
    if (m) {
      if (current) params.push(current);
      const rawName = m[1];
      let kind = "regular";
      let name = rawName;
      if (rawName.startsWith("**")) {
        kind = "var_keyword";
        name = rawName.slice(2);
      } else if (rawName.startsWith("*")) {
        kind = "var_positional";
        name = rawName.slice(1);
      }
      current = { name, type: m[2], description: m[3], kind };
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed) {
        current.description += "\n" + trimmed;
      }
    }
  }
  if (current) params.push(current);
  return params;
}
var RETURN_WITH_TYPE_RE = /^(\S.*?):\s+(.*)/;
function parseReturnEntry(body) {
  const content = body.map((l) => l.trim()).filter(Boolean).join(" ");
  if (!content) return void 0;
  const m = RETURN_WITH_TYPE_RE.exec(content);
  if (m) {
    return { type: m[1], description: m[2] };
  }
  return { description: content };
}
var RAISES_ENTRY_RE = /^(\w[\w.]*(?:\[.*?\])?)\s*(?:\(.*?\))?:\s*(.*)/;
function parseRaisesEntries(body) {
  const raises = [];
  let current = null;
  for (const line of body) {
    const m = RAISES_ENTRY_RE.exec(line);
    if (m) {
      if (current) raises.push(current);
      current = { type: m[1], description: m[2] };
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed) current.description += "\n" + trimmed;
    }
  }
  if (current) raises.push(current);
  return raises;
}

// src/docstringParser/numpyParser.ts
var PARAM_SECTIONS = /* @__PURE__ */ new Set(["parameters", "params", "arguments", "args", "attributes"]);
var RAISES_SECTIONS = /* @__PURE__ */ new Set(["raises", "raise", "except", "exceptions"]);
var RETURNS_SECTIONS = /* @__PURE__ */ new Set(["returns", "return"]);
var YIELDS_SECTIONS = /* @__PURE__ */ new Set(["yields", "yield"]);
function parseNumpyDocstring(docLines, startLine) {
  const firstLine = docLines[0] ?? "";
  const indent = firstLine.match(/^(\s*)/)?.[1] ?? "";
  const quotes = firstLine.trimStart().startsWith("'''") ? "'''" : '"""';
  const inner = normalizeLines2(docLines, indent, quotes);
  const summary = inner[0] ?? "";
  const rest = inner.slice(1);
  const { extendedSummary, sections } = splitNumpySections(rest);
  let args = [];
  let returns;
  let yields;
  let raises = [];
  const customSections = [];
  for (const { header, body } of sections) {
    const key = header.trim().toLowerCase();
    if (PARAM_SECTIONS.has(key)) {
      args = parseNumpyParams(body);
    } else if (RETURNS_SECTIONS.has(key)) {
      returns = parseNumpyReturn(body);
    } else if (YIELDS_SECTIONS.has(key)) {
      yields = parseNumpyReturn(body);
    } else if (RAISES_SECTIONS.has(key)) {
      raises = parseNumpyRaises(body);
    } else {
      customSections.push({
        header: header + "\n" + "-".repeat(header.length),
        contentLines: body
      });
    }
  }
  return {
    summary,
    extendedSummary,
    args,
    returns,
    yields,
    raises,
    customSections,
    startLine,
    endLine: startLine + docLines.length - 1,
    indent,
    quotes
  };
}
function normalizeLines2(docLines, indent, quotes) {
  const result = [];
  for (let i = 0; i < docLines.length; i++) {
    const raw = docLines[i];
    if (i === 0) {
      result.push(raw.trimStart().slice(quotes.length));
      continue;
    }
    if (i === docLines.length - 1) continue;
    result.push(raw.trim() === "" ? "" : raw.startsWith(indent) ? raw.slice(indent.length) : raw);
  }
  return result;
}
function splitNumpySections(lines) {
  const sections = [];
  const extended = [];
  let current = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() !== "" && i + 1 < lines.length && /^-{2,}$/.test(lines[i + 1].trim())) {
      current = { header: line.trim(), body: [] };
      sections.push(current);
      i += 2;
      continue;
    }
    if (current) {
      if (line.trim() === "") {
        current.body.push("");
      } else if (line.startsWith("    ")) {
        current.body.push(line.slice(4));
      } else {
        current.body.push(line);
      }
    } else {
      extended.push(line);
    }
    i++;
  }
  while (extended.length > 0 && extended[extended.length - 1].trim() === "") extended.pop();
  return { extendedSummary: extended.join("\n"), sections };
}
function parseNumpyParams(body) {
  const params = [];
  let current = null;
  let parsingDesc = false;
  for (const line of body) {
    if (line.trim() === "") {
      parsingDesc = false;
      continue;
    }
    if (!line.startsWith("    ") && !line.startsWith("	")) {
      if (current) params.push(current);
      const colonIdx = line.indexOf(" : ");
      const rawName = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line.trim();
      const type = colonIdx >= 0 ? line.slice(colonIdx + 3).trim() : void 0;
      let kind = "regular";
      let name = rawName;
      if (rawName.startsWith("**")) {
        kind = "var_keyword";
        name = rawName.slice(2);
      } else if (rawName.startsWith("*")) {
        kind = "var_positional";
        name = rawName.slice(1);
      }
      current = { name, type, description: "", kind };
      parsingDesc = true;
    } else if (current && parsingDesc) {
      const trimmed = line.trim();
      current.description = current.description ? current.description + "\n" + trimmed : trimmed;
    }
  }
  if (current) params.push(current);
  return params;
}
function parseNumpyReturn(body) {
  let type;
  let desc = "";
  for (const line of body) {
    if (line.trim() === "") continue;
    if (!line.startsWith("    ") && type === void 0) {
      type = line.trim();
    } else {
      desc = desc ? desc + "\n" + line.trim() : line.trim();
    }
  }
  if (!type && !desc) return void 0;
  if (type && !desc) return { type, description: "" };
  if (!type) return { description: desc };
  return { type, description: desc };
}
function parseNumpyRaises(body) {
  const raises = [];
  let current = null;
  for (const line of body) {
    if (line.trim() === "") continue;
    if (!line.startsWith("    ")) {
      if (current) raises.push(current);
      current = { type: line.trim(), description: "" };
    } else if (current) {
      const t = line.trim();
      current.description = current.description ? current.description + "\n" + t : t;
    }
  }
  if (current) raises.push(current);
  return raises;
}

// src/docstringParser/sphinxParser.ts
function parseSphinxDocstring(docLines, startLine) {
  const firstLine = docLines[0] ?? "";
  const indent = firstLine.match(/^(\s*)/)?.[1] ?? "";
  const quotes = firstLine.trimStart().startsWith("'''") ? "'''" : '"""';
  const inner = normalizeLines3(docLines, indent, quotes);
  const summary = inner[0] ?? "";
  const rest = inner.slice(1);
  const { extendedSummary, fields } = parseSphinxFields(rest);
  const paramMap = /* @__PURE__ */ new Map();
  let returnDesc = "";
  let returnType;
  let yieldDesc = "";
  let yieldType;
  const raises = [];
  const customSections = [];
  for (const { tag, name, value } of fields) {
    if (tag === "param" || tag === "parameter" || tag === "arg") {
      const rawName = name ?? "";
      let kind = "regular";
      let n = rawName;
      if (rawName.startsWith("**")) {
        kind = "var_keyword";
        n = rawName.slice(2);
      } else if (rawName.startsWith("*")) {
        kind = "var_positional";
        n = rawName.slice(1);
      }
      const existing = paramMap.get(n) ?? { desc: "", kind };
      paramMap.set(n, { ...existing, desc: value, kind });
    } else if (tag === "type") {
      const n = name ?? "";
      const existing = paramMap.get(n) ?? { desc: "", kind: "regular" };
      paramMap.set(n, { ...existing, type: value });
    } else if (tag === "returns" || tag === "return") {
      returnDesc = value;
    } else if (tag === "rtype") {
      returnType = value;
    } else if (tag === "yields" || tag === "yield") {
      yieldDesc = value;
    } else if (tag === "ytype") {
      yieldType = value;
    } else if (tag === "raises" || tag === "raise" || tag === "except") {
      raises.push({ type: name ?? tag, description: value });
    } else {
      customSections.push({
        header: name ? `:${tag} ${name}:` : `:${tag}:`,
        contentLines: [value]
      });
    }
  }
  const args = Array.from(paramMap.entries()).map(([nm, v]) => ({
    name: nm,
    type: v.type,
    description: v.desc,
    kind: v.kind
  }));
  const returns = returnDesc || returnType ? { type: returnType, description: returnDesc } : void 0;
  const yields = yieldDesc || yieldType ? { type: yieldType, description: yieldDesc } : void 0;
  return {
    summary,
    extendedSummary,
    args,
    returns,
    yields,
    raises,
    customSections,
    startLine,
    endLine: startLine + docLines.length - 1,
    indent,
    quotes
  };
}
function normalizeLines3(docLines, indent, quotes) {
  return docLines.map((raw, i) => {
    if (i === 0) return raw.trimStart().slice(quotes.length);
    if (i === docLines.length - 1) return null;
    return raw.trim() === "" ? "" : raw.startsWith(indent) ? raw.slice(indent.length) : raw;
  }).filter((l) => l !== null);
}
var FIELD_RE = /^:(\w+)(?:\s+([^:]+))?:\s*(.*)/;
function parseSphinxFields(lines) {
  const extended = [];
  const fields = [];
  let current = null;
  let inFields = false;
  for (const line of lines) {
    const m = FIELD_RE.exec(line);
    if (m) {
      inFields = true;
      if (current) fields.push(current);
      current = { tag: m[1], name: m[2]?.trim(), value: m[3] };
    } else if (current) {
      const t = line.trim();
      if (t) current.value += " " + t;
    } else if (!inFields) {
      extended.push(line);
    }
  }
  if (current) fields.push(current);
  while (extended.length > 0 && extended[extended.length - 1].trim() === "") extended.pop();
  return { extendedSummary: extended.join("\n"), fields };
}

// src/docstringParser/merger.ts
function mergeDocstring(parsed, sig, cfg) {
  const args = mergeArgs(parsed.args, sig.params, cfg);
  const { returns, yields } = mergeReturns(parsed, sig, cfg);
  return {
    ...parsed,
    args,
    returns,
    yields
    // Raises and custom sections are preserved as-is
  };
}
function mergeArgs(existing, params, cfg) {
  const existingMap = new Map(existing.map((p) => [p.name, p]));
  return params.filter((param) => {
    if (existingMap.has(param.name)) return true;
    return !cfg.includeTypes || param.type !== void 0;
  }).map((param) => {
    const prev = existingMap.get(param.name);
    const type = cfg.includeTypes ? param.type : void 0;
    if (prev) {
      return { ...prev, type };
    }
    const kind = param.kind;
    let desc = cfg.placeholderDescription;
    if (cfg.includeDefaults && param.default !== void 0) {
      desc += `. Defaults to ${param.default}.`;
    }
    return { name: param.name, type, description: desc, kind };
  });
}
function mergeReturns(parsed, sig, cfg) {
  if (sig.kind === "class") return { returns: void 0, yields: void 0 };
  const shouldSkipReturns = cfg.returnsMode === "auto" && !sig.hasReturnValue && !sig.isGenerator && !(sig.returnType && sig.returnType !== "None");
  if (sig.isGenerator) {
    const existingYields = parsed.yields ?? parsed.returns;
    const yields = shouldSkipReturns ? void 0 : existingYields ? { type: sig.returnType, description: existingYields.description } : { type: sig.returnType, description: cfg.placeholderDescription };
    return { returns: void 0, yields };
  }
  const returns = shouldSkipReturns ? void 0 : parsed.returns ? { type: sig.returnType ?? parsed.returns.type, description: parsed.returns.description } : { type: sig.returnType, description: cfg.placeholderDescription };
  return { returns, yields: void 0 };
}

// src/docstringParser/renderer.ts
function renderDocstring(parsed, format) {
  switch (format) {
    case "numpy":
      return renderNumpy(parsed);
    case "sphinx":
      return renderSphinx(parsed);
    default:
      return renderGoogle(parsed);
  }
}
function renderGoogle(p) {
  const { indent, quotes, summary } = p;
  const hasSections = p.args.length > 0 || p.returns || p.yields || p.raises.length > 0 || p.customSections.length > 0;
  const hasExtended = p.extendedSummary.trim() !== "";
  if (!hasSections && !hasExtended) {
    return [`${indent}${quotes}${summary}${quotes}`];
  }
  const lines = [];
  lines.push(`${indent}${quotes}${summary}`);
  if (hasExtended) {
    lines.push("");
    for (const l of p.extendedSummary.split("\n")) {
      lines.push(l.trim() === "" ? "" : `${indent}${l}`);
    }
  }
  const sections = [];
  if (p.args.length > 0) sections.push(renderGoogleArgs(p.args, indent));
  const retSection = renderGoogleReturn(
    p.returns ?? p.yields,
    indent,
    p.yields ? "Yields" : "Returns"
  );
  if (retSection) sections.push(retSection);
  if (p.raises.length > 0) sections.push(renderGoogleRaises(p.raises, indent));
  for (const cs of p.customSections) sections.push(renderGoogleCustom(cs, indent));
  for (const section of sections) {
    lines.push("");
    lines.push(...section);
  }
  lines.push(`${indent}${quotes}`);
  return lines;
}
function renderGoogleArgs(args, indent) {
  const lines = [`${indent}Args:`];
  for (const arg of args) {
    const displayName = arg.kind === "var_positional" ? `*${arg.name}` : arg.kind === "var_keyword" ? `**${arg.name}` : arg.name;
    const typePart = arg.type ? ` (${arg.type})` : "";
    const firstLine = `${indent}    ${displayName}${typePart}: ${arg.description.split("\n")[0]}`;
    lines.push(firstLine);
    for (const cont of arg.description.split("\n").slice(1)) {
      lines.push(`${indent}        ${cont}`);
    }
  }
  return lines;
}
function renderGoogleReturn(ret, indent, header) {
  if (!ret) return null;
  if (ret.type === "None") {
    return [`${indent}${header}:`, `${indent}    None`];
  }
  const typePart = ret.type ? `${ret.type}: ` : "";
  return [`${indent}${header}:`, `${indent}    ${typePart}${ret.description}`];
}
function renderGoogleRaises(raises, indent) {
  const lines = [`${indent}Raises:`];
  for (const r of raises) {
    lines.push(`${indent}    ${r.type}: ${r.description}`);
  }
  return lines;
}
function renderGoogleCustom(cs, indent) {
  let end = cs.contentLines.length;
  while (end > 0 && cs.contentLines[end - 1].trim() === "") end--;
  const lines = [`${indent}${cs.header}`];
  for (let i = 0; i < end; i++) {
    const l = cs.contentLines[i];
    lines.push(l.trim() === "" ? "" : `${indent}    ${l}`);
  }
  return lines;
}
function renderNumpy(p) {
  const { indent, quotes, summary } = p;
  const hasSections = p.args.length > 0 || p.returns || p.yields || p.raises.length > 0 || p.customSections.length > 0;
  if (!hasSections && p.extendedSummary.trim() === "") {
    return [`${indent}${quotes}${summary}${quotes}`];
  }
  const lines = [`${indent}${quotes}${summary}`];
  if (p.extendedSummary.trim()) {
    lines.push("");
    for (const l of p.extendedSummary.split("\n")) {
      lines.push(l.trim() === "" ? "" : `${indent}${l}`);
    }
  }
  if (p.args.length > 0) {
    lines.push("", `${indent}Parameters`, `${indent}----------`);
    for (const arg of p.args) {
      const displayName = arg.kind === "var_positional" ? `*${arg.name}` : arg.kind === "var_keyword" ? `**${arg.name}` : arg.name;
      const typePart = arg.type ? ` : ${arg.type}` : "";
      lines.push(`${indent}${displayName}${typePart}`);
      for (const dl of arg.description.split("\n")) {
        lines.push(`${indent}    ${dl}`);
      }
    }
  }
  const retEntry = p.returns ?? p.yields;
  const retHeader = p.yields ? "Yields" : "Returns";
  if (retEntry) {
    const dashes = "-".repeat(retHeader.length);
    lines.push("", `${indent}${retHeader}`, `${indent}${dashes}`);
    if (retEntry.type) lines.push(`${indent}${retEntry.type}`);
    lines.push(`${indent}    ${retEntry.description}`);
  }
  if (p.raises.length > 0) {
    lines.push("", `${indent}Raises`, `${indent}------`);
    for (const r of p.raises) {
      lines.push(`${indent}${r.type}`);
      lines.push(`${indent}    ${r.description}`);
    }
  }
  for (const cs of p.customSections) {
    const rawHeader = cs.header.replace(/\n-+$/, "");
    const dashes = "-".repeat(rawHeader.length);
    lines.push("", `${indent}${rawHeader}`, `${indent}${dashes}`);
    for (const l of cs.contentLines) lines.push(`${indent}    ${l}`);
  }
  lines.push(`${indent}${quotes}`);
  return lines;
}
function renderSphinx(p) {
  const { indent, quotes, summary } = p;
  const lines = [`${indent}${quotes}${summary}`];
  if (p.extendedSummary.trim()) {
    lines.push("");
    for (const l of p.extendedSummary.split("\n")) {
      lines.push(l.trim() === "" ? "" : `${indent}${l}`);
    }
  }
  const bodyLines = [];
  for (const arg of p.args) {
    const displayName = arg.kind === "var_positional" ? `*${arg.name}` : arg.kind === "var_keyword" ? `**${arg.name}` : arg.name;
    bodyLines.push(`${indent}:param ${displayName}: ${arg.description}`);
    if (arg.type) bodyLines.push(`${indent}:type ${displayName}: ${arg.type}`);
  }
  const retEntry = p.returns ?? p.yields;
  if (retEntry) {
    const retLabel = p.yields ? "yields" : "returns";
    bodyLines.push(`${indent}:${retLabel}: ${retEntry.description}`);
    if (retEntry.type) {
      const rtypeLabel = p.yields ? "ytype" : "rtype";
      bodyLines.push(`${indent}:${rtypeLabel}: ${retEntry.type}`);
    }
  }
  for (const r of p.raises) {
    bodyLines.push(`${indent}:raises ${r.type}: ${r.description}`);
  }
  if (bodyLines.length > 0) {
    lines.push("");
    lines.push(...bodyLines);
  }
  lines.push(`${indent}${quotes}`);
  return lines;
}

// src/docstringParser/index.ts
function parseDocstring(docLines, startLine, format) {
  switch (format) {
    case "numpy":
      return parseNumpyDocstring(docLines, startLine);
    case "sphinx":
      return parseSphinxDocstring(docLines, startLine);
    default:
      return parseGoogleDocstring(docLines, startLine);
  }
}
function updateDocstring(docLines, startLine, sig, cfg) {
  const parsed = parseDocstring(docLines, startLine, cfg.format);
  const merged = mergeDocstring(parsed, sig, cfg);
  return renderDocstring(merged, cfg.format);
}

// src/parser/signatureParser.ts
function extractAllSignatures(tree) {
  const sigs = [];
  visitNode(tree.rootNode, sigs);
  return sigs;
}
function findDefNodeAtLine(tree, line, column = 0) {
  let node = tree.rootNode.descendantForPosition({
    row: line,
    column
  });
  while (node) {
    if (node.type === "function_definition" || node.type === "class_definition") {
      const parent = node.parent;
      const decorated = parent?.type === "decorated_definition" ? parent : void 0;
      return { def: node, decorated };
    }
    node = node.parent;
  }
  return null;
}
function extractSignature(defNode, decoratedNode) {
  const isFunction = defNode.type === "function_definition";
  const isClass = defNode.type === "class_definition";
  if (!isFunction && !isClass) return null;
  const nameNode = defNode.childForFieldName("name");
  if (!nameNode) return null;
  const startLine = (decoratedNode ?? defNode).startPosition.row;
  const defLine = defNode.startPosition.row;
  const bodyNode = defNode.childForFieldName("body");
  if (!bodyNode) return null;
  const bodyStartLine = bodyNode.startPosition.row;
  const bodyEndLine = bodyNode.endPosition.row;
  let params = [];
  let isAsync = false;
  let returnType;
  let isGenerator = false;
  let raises = [];
  if (isFunction) {
    isAsync = defNode.children.some((c) => c.type === "async");
    const paramsNode = defNode.childForFieldName("parameters");
    if (paramsNode) params = extractParams(paramsNode);
    const retNode = defNode.childForFieldName("return_type");
    if (retNode) returnType = retNode.text;
    isGenerator = detectGenerator(bodyNode);
    raises = detectRaises(bodyNode);
  }
  const hasReturnValue = isFunction ? detectReturnValue(bodyNode) : false;
  const decorators = [];
  if (decoratedNode) {
    for (const child of decoratedNode.children) {
      if (child.type === "decorator") {
        decorators.push(child.text.slice(1).trim());
      }
    }
  }
  return {
    kind: isFunction ? "function" : "class",
    name: nameNode.text,
    params,
    returnType,
    hasReturnValue,
    isAsync,
    isGenerator,
    raises,
    decorators,
    startLine,
    defLine,
    bodyStartLine,
    bodyEndLine
  };
}
function hasDocstring(defNode) {
  return getDocstringStmtNode(defNode) !== null;
}
function getDocstringStmtNode(defNode) {
  const bodyNode = defNode.childForFieldName("body");
  if (!bodyNode) return null;
  for (const child of bodyNode.children) {
    if (!child.isNamed) continue;
    if (child.type !== "expression_statement") break;
    const expr = child.children.find((c) => c.isNamed);
    if (expr?.type === "string") return child;
    break;
  }
  return null;
}
function hasModuleDocstring(tree) {
  for (const child of tree.rootNode.children) {
    if (!child.isNamed || child.type === "comment") continue;
    if (child.type !== "expression_statement") return false;
    const expr = child.children.find((c) => c.isNamed);
    return expr?.type === "string";
  }
  return false;
}
function visitNode(node, sigs) {
  if (node.type === "decorated_definition") {
    const defNode = node.childForFieldName("definition");
    if (defNode && (defNode.type === "function_definition" || defNode.type === "class_definition")) {
      const sig = extractSignature(defNode, node);
      if (sig) sigs.push(sig);
      const body = defNode.childForFieldName("body");
      if (body) {
        for (const child of body.children) visitNode(child, sigs);
      }
    }
    return;
  }
  if (node.type === "function_definition" || node.type === "class_definition") {
    const sig = extractSignature(node);
    if (sig) sigs.push(sig);
    const body = node.childForFieldName("body");
    if (body) {
      for (const child of body.children) visitNode(child, sigs);
    }
    return;
  }
  for (const child of node.children) visitNode(child, sigs);
}
function extractParams(paramsNode) {
  const params = [];
  let afterStar = false;
  for (const child of paramsNode.children) {
    switch (child.type) {
      case "identifier": {
        const name = child.text;
        if (name === "self" || name === "cls") break;
        params.push({ name, kind: afterStar ? "keyword_only" : "regular" });
        break;
      }
      case "typed_parameter": {
        const listSplat = child.children.find((c) => c.type === "list_splat_pattern");
        if (listSplat) {
          const name2 = listSplat.children.find((c) => c.type === "identifier")?.text;
          if (name2) {
            const typeText2 = child.children.find((c) => c.type === "type")?.text;
            params.push({ name: name2, type: typeText2, kind: "var_positional" });
            afterStar = true;
          }
          break;
        }
        const dictSplat = child.children.find((c) => c.type === "dictionary_splat_pattern");
        if (dictSplat) {
          const name2 = dictSplat.children.find((c) => c.type === "identifier")?.text;
          if (name2) {
            const typeText2 = child.children.find((c) => c.type === "type")?.text;
            params.push({ name: name2, type: typeText2, kind: "var_keyword" });
          }
          break;
        }
        const name = child.children.find((c) => c.type === "identifier")?.text;
        if (!name || name === "self" || name === "cls") break;
        const typeText = child.children.find((c) => c.type === "type")?.text;
        params.push({
          name,
          type: typeText,
          kind: afterStar ? "keyword_only" : "regular"
        });
        break;
      }
      case "default_parameter": {
        const name = child.childForFieldName("name")?.text;
        if (!name || name === "self" || name === "cls") break;
        const defaultVal = child.childForFieldName("value")?.text;
        params.push({
          name,
          default: defaultVal,
          kind: afterStar ? "keyword_only" : "regular"
        });
        break;
      }
      case "typed_default_parameter": {
        const name = child.childForFieldName("name")?.text;
        if (!name || name === "self" || name === "cls") break;
        const typeText = child.childForFieldName("type")?.text;
        const defaultVal = child.childForFieldName("value")?.text;
        params.push({
          name,
          type: typeText,
          default: defaultVal,
          kind: afterStar ? "keyword_only" : "regular"
        });
        break;
      }
      case "list_splat_pattern": {
        const ident = child.children.find((c) => c.type === "identifier");
        if (ident) {
          params.push({ name: ident.text, kind: "var_positional" });
        }
        afterStar = true;
        break;
      }
      case "keyword_separator": {
        afterStar = true;
        break;
      }
      case "positional_separator": {
        for (const p of params) {
          p.kind = "positional_only";
        }
        break;
      }
      case "dictionary_splat_pattern": {
        const ident = child.children.find((c) => c.type === "identifier");
        if (ident) {
          params.push({ name: ident.text, kind: "var_keyword" });
        }
        break;
      }
    }
  }
  return params;
}
function detectReturnValue(bodyNode) {
  function search(node) {
    if (node.type === "function_definition" || node.type === "class_definition") {
      return false;
    }
    if (node.type === "return_statement") {
      const expr = node.children.find((c) => c.isNamed);
      return !!expr && expr.text !== "None";
    }
    return node.children.some((c) => search(c));
  }
  return search(bodyNode);
}
function detectGenerator(bodyNode) {
  function search(node) {
    if (node.type === "function_definition" || node.type === "class_definition") {
      return false;
    }
    if (node.type === "yield" || node.type === "yield_from") return true;
    return node.children.some((c) => search(c));
  }
  return search(bodyNode);
}
function detectRaises(bodyNode) {
  const seen = /* @__PURE__ */ new Set();
  const order = [];
  function search(node) {
    if (node.type === "function_definition" || node.type === "class_definition") {
      return;
    }
    if (node.type === "raise_statement") {
      const expr = node.children.find((c) => c.isNamed && c.type !== "raise");
      if (expr) {
        const name = resolveExceptionName(expr);
        if (name && /^[A-Z]/.test(name) && !seen.has(name)) {
          seen.add(name);
          order.push(name);
        }
      }
      return;
    }
    node.children.forEach((c) => search(c));
  }
  search(bodyNode);
  return order;
}
function resolveExceptionName(node) {
  if (node.type === "identifier") return node.text;
  if (node.type === "call") {
    const fn = node.childForFieldName("function");
    return fn ? resolveExceptionName(fn) : null;
  }
  if (node.type === "attribute") {
    const attr = node.childForFieldName("attribute");
    return attr ? attr.text : null;
  }
  return null;
}

// src/parser/treeSitter.ts
var import_fs = require("fs");
var import_path = require("path");
var import_web_tree_sitter = require("web-tree-sitter");
var parser = null;
function getModuleDir() {
  if (typeof __dirname === "string" && __dirname.length > 0) {
    return __dirname;
  }
  return process.cwd();
}
function resolveWasm(filename, packageName) {
  const moduleDir = getModuleDir();
  const localPath = (0, import_path.join)(moduleDir, filename);
  if ((0, import_fs.existsSync)(localPath)) return localPath;
  const nodeModulesPath = (0, import_path.resolve)(moduleDir, "../../../node_modules", packageName, filename);
  if ((0, import_fs.existsSync)(nodeModulesPath)) return nodeModulesPath;
  for (const basePath of [
    (0, import_path.resolve)(moduleDir, "../../.."),
    // From src/parser/
    process.cwd()
  ]) {
    const candidate = (0, import_path.join)(basePath, "node_modules", packageName, filename);
    if ((0, import_fs.existsSync)(candidate)) return candidate;
  }
  throw new Error(`Cannot find ${filename}. Searched: ${localPath}, ${nodeModulesPath}`);
}
async function initParser() {
  if (parser !== null) return;
  const webTSWasm = resolveWasm("web-tree-sitter.wasm", "web-tree-sitter");
  const pythonWasm = resolveWasm("tree-sitter-python.wasm", "tree-sitter-python");
  await import_web_tree_sitter.Parser.init({ wasmBinary: (0, import_fs.readFileSync)(webTSWasm) });
  const Python = await import_web_tree_sitter.Language.load(pythonWasm);
  parser = new import_web_tree_sitter.Parser();
  parser.setLanguage(Python);
}
function getParser() {
  if (!parser) {
    throw new Error("Tree-sitter parser not initialised. Call initParser() first.");
  }
  return parser;
}
function parseCode(code) {
  return getParser().parse(code);
}

// src/types.ts
var DEFAULT_CONFIG = {
  format: "google",
  quoteStyle: "double",
  includeTypes: true,
  includeDefaults: true,
  returnsMode: "auto",
  generateModuleDocstring: true,
  placeholderSummary: "_summary_",
  placeholderDescription: "_description_"
};

// src/parser/index.ts
function resolveConfig(cfg) {
  return { ...DEFAULT_CONFIG, ...cfg };
}
function findSignatureAtLine(lines, lineNum) {
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return null;
  const found = findDefNodeAtLine(tree, lineNum);
  if (!found) return null;
  return extractSignature(found.def, found.decorated) ?? null;
}
function generateFileInsertions(lines, config) {
  const cfg = resolveConfig(config);
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return [];
  const insertions = [];
  if (cfg.generateModuleDocstring && !hasModuleDocstring(tree)) {
    const moduleDocLine = findModuleDocInsertLine(lines);
    if (moduleDocLine !== null) {
      const q = cfg.quoteStyle === "single" ? "'''" : '"""';
      insertions.push({
        afterLine: moduleDocLine,
        lines: [`${q}${cfg.placeholderSummary}.${q}`, ""]
      });
    }
  }
  const sigs = extractAllSignatures(tree);
  for (const sig of sigs) {
    const found = findDefNodeAtLine(tree, sig.defLine);
    if (!found) continue;
    if (hasDocstring(found.def)) continue;
    const bodyIndent = lines[sig.bodyStartLine]?.match(/^(\s*)/)?.[1] ?? "";
    const docText = buildDocstringText(sig, bodyIndent, cfg);
    insertions.push({
      afterLine: sig.bodyStartLine - 1,
      lines: docText.split("\n")
    });
  }
  return insertions;
}
function applyInsertions(lines, insertions) {
  const sorted = [...insertions].sort((a, b) => a.afterLine - b.afterLine);
  const result = [...lines];
  let offset = 0;
  for (const ins of sorted) {
    const at = ins.afterLine + 1 + offset;
    result.splice(at, 0, ...ins.lines);
    offset += ins.lines.length;
  }
  return result;
}
function getUpdateOperations(lines, config) {
  const cfg = resolveConfig(config);
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return [];
  const replacements = [];
  const sigs = extractAllSignatures(tree);
  for (const sig of sigs) {
    const defCol = (lines[sig.defLine] ?? "").match(/^(\s*)/)?.[1]?.length ?? 0;
    const found = findDefNodeAtLine(tree, sig.defLine, defCol);
    if (!found) continue;
    const stmtNode = getDocstringStmtNode(found.def);
    if (!stmtNode) continue;
    const docStart = stmtNode.startPosition.row;
    const docEnd = stmtNode.endPosition.row;
    const docLines = lines.slice(docStart, docEnd + 1);
    const newLines = updateDocstring(docLines, docStart, sig, cfg);
    replacements.push({
      startLine: docStart,
      endLine: docEnd,
      newLines
    });
  }
  return replacements;
}
function applyReplacements(lines, replacements) {
  const sorted = [...replacements].sort((a, b) => b.startLine - a.startLine);
  const result = [...lines];
  for (const rep of sorted) {
    result.splice(rep.startLine, rep.endLine - rep.startLine + 1, ...rep.newLines);
  }
  return result;
}
function getGenerateAndUpdateOperations(lines, config) {
  const cfg = resolveConfig(config);
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return { generated: 0, updated: 0, ops: [] };
  const insertions = generateFileInsertions(lines, cfg);
  const replacements = getUpdateOperations(lines, cfg);
  return {
    generated: insertions.length,
    updated: replacements.length,
    ops: [
      ...insertions.map((i) => ({ pos: i.afterLine, lines: i.lines, kind: "insert" })),
      ...replacements.map((r) => ({
        pos: r.startLine,
        lines: r.newLines,
        kind: "replace",
        replaceCount: r.endLine - r.startLine + 1
      }))
    ]
  };
}
function applyGenerateAndUpdateOperations(lines, ops) {
  const result = [...lines];
  ops.sort((a, b) => b.pos - a.pos);
  for (const op of ops) {
    if (op.kind === "replace") {
      result.splice(op.pos, op.replaceCount ?? 0, ...op.lines);
    } else {
      result.splice(op.pos + 1, 0, ...op.lines);
    }
  }
  return result;
}
function buildDocstringForLine(lines, lineNum, config) {
  const cfg = resolveConfig(config);
  const sig = findSignatureAtLine(lines, lineNum);
  if (!sig) return null;
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return null;
  const found = findDefNodeAtLine(tree, sig.defLine);
  if (!found || hasDocstring(found.def)) return null;
  const bodyIndent = lines[sig.bodyStartLine]?.match(/^(\s*)/)?.[1] ?? "";
  const docText = buildDocstringText(sig, bodyIndent, cfg);
  return { docText, bodyIndent, afterLine: sig.bodyStartLine - 1 };
}
function buildSnippetForLine(lines, lineNum, config) {
  const cfg = resolveConfig(config);
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return null;
  const found = findDefNodeAtLine(tree, lineNum);
  if (!found) return null;
  if (hasDocstring(found.def)) return null;
  const sig = extractSignature(found.def, found.decorated);
  if (!sig) return null;
  const bodyIndent = lines[sig.bodyStartLine]?.match(/^(\s*)/)?.[1] ?? "";
  const snippet = buildDocstringSnippet(sig, bodyIndent, cfg);
  return { snippet, afterLine: sig.bodyStartLine - 1 };
}
function buildUpdateForLine(lines, lineNum, config) {
  const cfg = resolveConfig(config);
  const code = lines.join("\n");
  const tree = parseCode(code);
  if (!tree) return null;
  const found = findDefNodeAtLine(tree, lineNum);
  if (!found) return null;
  const stmtNode = getDocstringStmtNode(found.def);
  if (!stmtNode) return null;
  const sig = extractSignature(found.def, found.decorated);
  if (!sig) return null;
  const docStart = stmtNode.startPosition.row;
  const docEnd = stmtNode.endPosition.row;
  const docLines = lines.slice(docStart, docEnd + 1);
  const newLines = updateDocstring(docLines, docStart, sig, cfg);
  return { startLine: docStart, endLine: docEnd, newLines };
}
function findModuleDocInsertLine(lines) {
  let lastHeaderLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      lastHeaderLine = i;
    } else {
      break;
    }
  }
  return lastHeaderLine;
}

// src/commands.ts
var vscode2 = __toESM(require("vscode"));

// src/config.ts
var import_fs2 = require("fs");
var import_path2 = require("path");

// node_modules/smol-toml/dist/error.js
function getLineColFromPtr(string, ptr) {
  let lines = string.slice(0, ptr).split(/\r\n|\n|\r/g);
  return [lines.length, lines.pop().length + 1];
}
function makeCodeBlock(string, line, column) {
  let lines = string.split(/\r\n|\n|\r/g);
  let codeblock = "";
  let numberLen = (Math.log10(line + 1) | 0) + 1;
  for (let i = line - 1; i <= line + 1; i++) {
    let l = lines[i - 1];
    if (!l)
      continue;
    codeblock += i.toString().padEnd(numberLen, " ");
    codeblock += ":  ";
    codeblock += l;
    codeblock += "\n";
    if (i === line) {
      codeblock += " ".repeat(numberLen + column + 2);
      codeblock += "^\n";
    }
  }
  return codeblock;
}
var TomlError = class extends Error {
  line;
  column;
  codeblock;
  constructor(message, options) {
    const [line, column] = getLineColFromPtr(options.toml, options.ptr);
    const codeblock = makeCodeBlock(options.toml, line, column);
    super(`Invalid TOML document: ${message}

${codeblock}`, options);
    this.line = line;
    this.column = column;
    this.codeblock = codeblock;
  }
};

// node_modules/smol-toml/dist/util.js
function isEscaped(str, ptr) {
  let i = 0;
  while (str[ptr - ++i] === "\\")
    ;
  return --i && i % 2;
}
function indexOfNewline(str, start = 0, end = str.length) {
  let idx = str.indexOf("\n", start);
  if (str[idx - 1] === "\r")
    idx--;
  return idx <= end ? idx : -1;
}
function skipComment(str, ptr) {
  for (let i = ptr; i < str.length; i++) {
    let c = str[i];
    if (c === "\n")
      return i;
    if (c === "\r" && str[i + 1] === "\n")
      return i + 1;
    if (c < " " && c !== "	" || c === "\x7F") {
      throw new TomlError("control characters are not allowed in comments", {
        toml: str,
        ptr
      });
    }
  }
  return str.length;
}
function skipVoid(str, ptr, banNewLines, banComments) {
  let c;
  while (1) {
    while ((c = str[ptr]) === " " || c === "	" || !banNewLines && (c === "\n" || c === "\r" && str[ptr + 1] === "\n"))
      ptr++;
    if (banComments || c !== "#")
      break;
    ptr = skipComment(str, ptr);
  }
  return ptr;
}
function skipUntil(str, ptr, sep, end, banNewLines = false) {
  if (!end) {
    ptr = indexOfNewline(str, ptr);
    return ptr < 0 ? str.length : ptr;
  }
  for (let i = ptr; i < str.length; i++) {
    let c = str[i];
    if (c === "#") {
      i = indexOfNewline(str, i);
    } else if (c === sep) {
      return i + 1;
    } else if (c === end || banNewLines && (c === "\n" || c === "\r" && str[i + 1] === "\n")) {
      return i;
    }
  }
  throw new TomlError("cannot find end of structure", {
    toml: str,
    ptr
  });
}
function getStringEnd(str, seek) {
  let first = str[seek];
  let target = first === str[seek + 1] && str[seek + 1] === str[seek + 2] ? str.slice(seek, seek + 3) : first;
  seek += target.length - 1;
  do
    seek = str.indexOf(target, ++seek);
  while (seek > -1 && first !== "'" && isEscaped(str, seek));
  if (seek > -1) {
    seek += target.length;
    if (target.length > 1) {
      if (str[seek] === first)
        seek++;
      if (str[seek] === first)
        seek++;
    }
  }
  return seek;
}

// node_modules/smol-toml/dist/date.js
var DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})?[T ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|[-+]\d{2}:\d{2})?$/i;
var TomlDate = class _TomlDate extends Date {
  #hasDate = false;
  #hasTime = false;
  #offset = null;
  constructor(date) {
    let hasDate = true;
    let hasTime = true;
    let offset = "Z";
    if (typeof date === "string") {
      let match = date.match(DATE_TIME_RE);
      if (match) {
        if (!match[1]) {
          hasDate = false;
          date = `0000-01-01T${date}`;
        }
        hasTime = !!match[2];
        hasTime && date[10] === " " && (date = date.replace(" ", "T"));
        if (match[2] && +match[2] > 23) {
          date = "";
        } else {
          offset = match[3] || null;
          date = date.toUpperCase();
          if (!offset && hasTime)
            date += "Z";
        }
      } else {
        date = "";
      }
    }
    super(date);
    if (!isNaN(this.getTime())) {
      this.#hasDate = hasDate;
      this.#hasTime = hasTime;
      this.#offset = offset;
    }
  }
  isDateTime() {
    return this.#hasDate && this.#hasTime;
  }
  isLocal() {
    return !this.#hasDate || !this.#hasTime || !this.#offset;
  }
  isDate() {
    return this.#hasDate && !this.#hasTime;
  }
  isTime() {
    return this.#hasTime && !this.#hasDate;
  }
  isValid() {
    return this.#hasDate || this.#hasTime;
  }
  toISOString() {
    let iso = super.toISOString();
    if (this.isDate())
      return iso.slice(0, 10);
    if (this.isTime())
      return iso.slice(11, 23);
    if (this.#offset === null)
      return iso.slice(0, -1);
    if (this.#offset === "Z")
      return iso;
    let offset = +this.#offset.slice(1, 3) * 60 + +this.#offset.slice(4, 6);
    offset = this.#offset[0] === "-" ? offset : -offset;
    let offsetDate = new Date(this.getTime() - offset * 6e4);
    return offsetDate.toISOString().slice(0, -1) + this.#offset;
  }
  static wrapAsOffsetDateTime(jsDate, offset = "Z") {
    let date = new _TomlDate(jsDate);
    date.#offset = offset;
    return date;
  }
  static wrapAsLocalDateTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#offset = null;
    return date;
  }
  static wrapAsLocalDate(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasTime = false;
    date.#offset = null;
    return date;
  }
  static wrapAsLocalTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasDate = false;
    date.#offset = null;
    return date;
  }
};

// node_modules/smol-toml/dist/primitive.js
var INT_REGEX = /^((0x[0-9a-fA-F](_?[0-9a-fA-F])*)|(([+-]|0[ob])?\d(_?\d)*))$/;
var FLOAT_REGEX = /^[+-]?\d(_?\d)*(\.\d(_?\d)*)?([eE][+-]?\d(_?\d)*)?$/;
var LEADING_ZERO = /^[+-]?0[0-9_]/;
var ESCAPE_REGEX = /^[0-9a-f]{2,8}$/i;
var ESC_MAP = {
  b: "\b",
  t: "	",
  n: "\n",
  f: "\f",
  r: "\r",
  e: "\x1B",
  '"': '"',
  "\\": "\\"
};
function parseString(str, ptr = 0, endPtr = str.length) {
  let isLiteral = str[ptr] === "'";
  let isMultiline = str[ptr++] === str[ptr] && str[ptr] === str[ptr + 1];
  if (isMultiline) {
    endPtr -= 2;
    if (str[ptr += 2] === "\r")
      ptr++;
    if (str[ptr] === "\n")
      ptr++;
  }
  let tmp = 0;
  let isEscape;
  let parsed = "";
  let sliceStart = ptr;
  while (ptr < endPtr - 1) {
    let c = str[ptr++];
    if (c === "\n" || c === "\r" && str[ptr] === "\n") {
      if (!isMultiline) {
        throw new TomlError("newlines are not allowed in strings", {
          toml: str,
          ptr: ptr - 1
        });
      }
    } else if (c < " " && c !== "	" || c === "\x7F") {
      throw new TomlError("control characters are not allowed in strings", {
        toml: str,
        ptr: ptr - 1
      });
    }
    if (isEscape) {
      isEscape = false;
      if (c === "x" || c === "u" || c === "U") {
        let code = str.slice(ptr, ptr += c === "x" ? 2 : c === "u" ? 4 : 8);
        if (!ESCAPE_REGEX.test(code)) {
          throw new TomlError("invalid unicode escape", {
            toml: str,
            ptr: tmp
          });
        }
        try {
          parsed += String.fromCodePoint(parseInt(code, 16));
        } catch {
          throw new TomlError("invalid unicode escape", {
            toml: str,
            ptr: tmp
          });
        }
      } else if (isMultiline && (c === "\n" || c === " " || c === "	" || c === "\r")) {
        ptr = skipVoid(str, ptr - 1, true);
        if (str[ptr] !== "\n" && str[ptr] !== "\r") {
          throw new TomlError("invalid escape: only line-ending whitespace may be escaped", {
            toml: str,
            ptr: tmp
          });
        }
        ptr = skipVoid(str, ptr);
      } else if (c in ESC_MAP) {
        parsed += ESC_MAP[c];
      } else {
        throw new TomlError("unrecognized escape sequence", {
          toml: str,
          ptr: tmp
        });
      }
      sliceStart = ptr;
    } else if (!isLiteral && c === "\\") {
      tmp = ptr - 1;
      isEscape = true;
      parsed += str.slice(sliceStart, tmp);
    }
  }
  return parsed + str.slice(sliceStart, endPtr - 1);
}
function parseValue(value, toml, ptr, integersAsBigInt) {
  if (value === "true")
    return true;
  if (value === "false")
    return false;
  if (value === "-inf")
    return -Infinity;
  if (value === "inf" || value === "+inf")
    return Infinity;
  if (value === "nan" || value === "+nan" || value === "-nan")
    return NaN;
  if (value === "-0")
    return integersAsBigInt ? 0n : 0;
  let isInt = INT_REGEX.test(value);
  if (isInt || FLOAT_REGEX.test(value)) {
    if (LEADING_ZERO.test(value)) {
      throw new TomlError("leading zeroes are not allowed", {
        toml,
        ptr
      });
    }
    value = value.replace(/_/g, "");
    let numeric = +value;
    if (isNaN(numeric)) {
      throw new TomlError("invalid number", {
        toml,
        ptr
      });
    }
    if (isInt) {
      if ((isInt = !Number.isSafeInteger(numeric)) && !integersAsBigInt) {
        throw new TomlError("integer value cannot be represented losslessly", {
          toml,
          ptr
        });
      }
      if (isInt || integersAsBigInt === true)
        numeric = BigInt(value);
    }
    return numeric;
  }
  const date = new TomlDate(value);
  if (!date.isValid()) {
    throw new TomlError("invalid value", {
      toml,
      ptr
    });
  }
  return date;
}

// node_modules/smol-toml/dist/extract.js
function sliceAndTrimEndOf(str, startPtr, endPtr) {
  let value = str.slice(startPtr, endPtr);
  let commentIdx = value.indexOf("#");
  if (commentIdx > -1) {
    skipComment(str, commentIdx);
    value = value.slice(0, commentIdx);
  }
  return [value.trimEnd(), commentIdx];
}
function extractValue(str, ptr, end, depth, integersAsBigInt) {
  if (depth === 0) {
    throw new TomlError("document contains excessively nested structures. aborting.", {
      toml: str,
      ptr
    });
  }
  let c = str[ptr];
  if (c === "[" || c === "{") {
    let [value, endPtr2] = c === "[" ? parseArray(str, ptr, depth, integersAsBigInt) : parseInlineTable(str, ptr, depth, integersAsBigInt);
    if (end) {
      endPtr2 = skipVoid(str, endPtr2);
      if (str[endPtr2] === ",")
        endPtr2++;
      else if (str[endPtr2] !== end) {
        throw new TomlError("expected comma or end of structure", {
          toml: str,
          ptr: endPtr2
        });
      }
    }
    return [value, endPtr2];
  }
  let endPtr;
  if (c === '"' || c === "'") {
    endPtr = getStringEnd(str, ptr);
    let parsed = parseString(str, ptr, endPtr);
    if (end) {
      endPtr = skipVoid(str, endPtr);
      if (str[endPtr] && str[endPtr] !== "," && str[endPtr] !== end && str[endPtr] !== "\n" && str[endPtr] !== "\r") {
        throw new TomlError("unexpected character encountered", {
          toml: str,
          ptr: endPtr
        });
      }
      endPtr += +(str[endPtr] === ",");
    }
    return [parsed, endPtr];
  }
  endPtr = skipUntil(str, ptr, ",", end);
  let slice = sliceAndTrimEndOf(str, ptr, endPtr - +(str[endPtr - 1] === ","));
  if (!slice[0]) {
    throw new TomlError("incomplete key-value declaration: no value specified", {
      toml: str,
      ptr
    });
  }
  if (end && slice[1] > -1) {
    endPtr = skipVoid(str, ptr + slice[1]);
    endPtr += +(str[endPtr] === ",");
  }
  return [
    parseValue(slice[0], str, ptr, integersAsBigInt),
    endPtr
  ];
}

// node_modules/smol-toml/dist/struct.js
var KEY_PART_RE = /^[a-zA-Z0-9-_]+[ \t]*$/;
function parseKey(str, ptr, end = "=") {
  let dot = ptr - 1;
  let parsed = [];
  let endPtr = str.indexOf(end, ptr);
  if (endPtr < 0) {
    throw new TomlError("incomplete key-value: cannot find end of key", {
      toml: str,
      ptr
    });
  }
  do {
    let c = str[ptr = ++dot];
    if (c !== " " && c !== "	") {
      if (c === '"' || c === "'") {
        if (c === str[ptr + 1] && c === str[ptr + 2]) {
          throw new TomlError("multiline strings are not allowed in keys", {
            toml: str,
            ptr
          });
        }
        let eos = getStringEnd(str, ptr);
        if (eos < 0) {
          throw new TomlError("unfinished string encountered", {
            toml: str,
            ptr
          });
        }
        dot = str.indexOf(".", eos);
        let strEnd = str.slice(eos, dot < 0 || dot > endPtr ? endPtr : dot);
        let newLine = indexOfNewline(strEnd);
        if (newLine > -1) {
          throw new TomlError("newlines are not allowed in keys", {
            toml: str,
            ptr: ptr + dot + newLine
          });
        }
        if (strEnd.trimStart()) {
          throw new TomlError("found extra tokens after the string part", {
            toml: str,
            ptr: eos
          });
        }
        if (endPtr < eos) {
          endPtr = str.indexOf(end, eos);
          if (endPtr < 0) {
            throw new TomlError("incomplete key-value: cannot find end of key", {
              toml: str,
              ptr
            });
          }
        }
        parsed.push(parseString(str, ptr, eos));
      } else {
        dot = str.indexOf(".", ptr);
        let part = str.slice(ptr, dot < 0 || dot > endPtr ? endPtr : dot);
        if (!KEY_PART_RE.test(part)) {
          throw new TomlError("only letter, numbers, dashes and underscores are allowed in keys", {
            toml: str,
            ptr
          });
        }
        parsed.push(part.trimEnd());
      }
    }
  } while (dot + 1 && dot < endPtr);
  return [parsed, skipVoid(str, endPtr + 1, true, true)];
}
function parseInlineTable(str, ptr, depth, integersAsBigInt) {
  let res = {};
  let seen = /* @__PURE__ */ new Set();
  let c;
  ptr++;
  while ((c = str[ptr++]) !== "}" && c) {
    if (c === ",") {
      throw new TomlError("expected value, found comma", {
        toml: str,
        ptr: ptr - 1
      });
    } else if (c === "#")
      ptr = skipComment(str, ptr);
    else if (c !== " " && c !== "	" && c !== "\n" && c !== "\r") {
      let k;
      let t = res;
      let hasOwn = false;
      let [key, keyEndPtr] = parseKey(str, ptr - 1);
      for (let i = 0; i < key.length; i++) {
        if (i)
          t = hasOwn ? t[k] : t[k] = {};
        k = key[i];
        if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== "object" || seen.has(t[k]))) {
          throw new TomlError("trying to redefine an already defined value", {
            toml: str,
            ptr
          });
        }
        if (!hasOwn && k === "__proto__") {
          Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
        }
      }
      if (hasOwn) {
        throw new TomlError("trying to redefine an already defined value", {
          toml: str,
          ptr
        });
      }
      let [value, valueEndPtr] = extractValue(str, keyEndPtr, "}", depth - 1, integersAsBigInt);
      seen.add(value);
      t[k] = value;
      ptr = valueEndPtr;
    }
  }
  if (!c) {
    throw new TomlError("unfinished table encountered", {
      toml: str,
      ptr
    });
  }
  return [res, ptr];
}
function parseArray(str, ptr, depth, integersAsBigInt) {
  let res = [];
  let c;
  ptr++;
  while ((c = str[ptr++]) !== "]" && c) {
    if (c === ",") {
      throw new TomlError("expected value, found comma", {
        toml: str,
        ptr: ptr - 1
      });
    } else if (c === "#")
      ptr = skipComment(str, ptr);
    else if (c !== " " && c !== "	" && c !== "\n" && c !== "\r") {
      let e = extractValue(str, ptr - 1, "]", depth - 1, integersAsBigInt);
      res.push(e[0]);
      ptr = e[1];
    }
  }
  if (!c) {
    throw new TomlError("unfinished array encountered", {
      toml: str,
      ptr
    });
  }
  return [res, ptr];
}

// node_modules/smol-toml/dist/parse.js
function peekTable(key, table, meta, type) {
  let t = table;
  let m = meta;
  let k;
  let hasOwn = false;
  let state;
  for (let i = 0; i < key.length; i++) {
    if (i) {
      t = hasOwn ? t[k] : t[k] = {};
      m = (state = m[k]).c;
      if (type === 0 && (state.t === 1 || state.t === 2)) {
        return null;
      }
      if (state.t === 2) {
        let l = t.length - 1;
        t = t[l];
        m = m[l].c;
      }
    }
    k = key[i];
    if ((hasOwn = Object.hasOwn(t, k)) && m[k]?.t === 0 && m[k]?.d) {
      return null;
    }
    if (!hasOwn) {
      if (k === "__proto__") {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
        Object.defineProperty(m, k, { enumerable: true, configurable: true, writable: true });
      }
      m[k] = {
        t: i < key.length - 1 && type === 2 ? 3 : type,
        d: false,
        i: 0,
        c: {}
      };
    }
  }
  state = m[k];
  if (state.t !== type && !(type === 1 && state.t === 3)) {
    return null;
  }
  if (type === 2) {
    if (!state.d) {
      state.d = true;
      t[k] = [];
    }
    t[k].push(t = {});
    state.c[state.i++] = state = { t: 1, d: false, i: 0, c: {} };
  }
  if (state.d) {
    return null;
  }
  state.d = true;
  if (type === 1) {
    t = hasOwn ? t[k] : t[k] = {};
  } else if (type === 0 && hasOwn) {
    return null;
  }
  return [k, t, state.c];
}
function parse(toml, { maxDepth = 1e3, integersAsBigInt } = {}) {
  let res = {};
  let meta = {};
  let tbl = res;
  let m = meta;
  for (let ptr = skipVoid(toml, 0); ptr < toml.length; ) {
    if (toml[ptr] === "[") {
      let isTableArray = toml[++ptr] === "[";
      let k = parseKey(toml, ptr += +isTableArray, "]");
      if (isTableArray) {
        if (toml[k[1] - 1] !== "]") {
          throw new TomlError("expected end of table declaration", {
            toml,
            ptr: k[1] - 1
          });
        }
        k[1]++;
      }
      let p = peekTable(
        k[0],
        res,
        meta,
        isTableArray ? 2 : 1
        /* Type.EXPLICIT */
      );
      if (!p) {
        throw new TomlError("trying to redefine an already defined table or value", {
          toml,
          ptr
        });
      }
      m = p[2];
      tbl = p[1];
      ptr = k[1];
    } else {
      let k = parseKey(toml, ptr);
      let p = peekTable(
        k[0],
        tbl,
        m,
        0
        /* Type.DOTTED */
      );
      if (!p) {
        throw new TomlError("trying to redefine an already defined table or value", {
          toml,
          ptr
        });
      }
      let v = extractValue(toml, k[1], void 0, maxDepth, integersAsBigInt);
      p[1][p[0]] = v[0];
      ptr = v[1];
    }
    ptr = skipVoid(toml, ptr, true);
    if (toml[ptr] && toml[ptr] !== "\n" && toml[ptr] !== "\r") {
      throw new TomlError("each key-value declaration must be followed by an end-of-line", {
        toml,
        ptr
      });
    }
    ptr = skipVoid(toml, ptr);
  }
  return res;
}

// src/config.ts
var vscode = __toESM(require("vscode"));
function getConfig() {
  const ws = vscode.workspace.getConfiguration("docdoc");
  const rawFormat = ws.get("format", "auto");
  const format = rawFormat === "auto" ? detectFormat() : rawFormat ?? "google";
  return {
    format,
    quoteStyle: ws.get("quoteStyle", DEFAULT_CONFIG.quoteStyle),
    includeTypes: ws.get("includeTypesFromAnnotations", DEFAULT_CONFIG.includeTypes),
    includeDefaults: ws.get("includeDefaults", DEFAULT_CONFIG.includeDefaults),
    returnsMode: ws.get("returns.mode", DEFAULT_CONFIG.returnsMode),
    generateModuleDocstring: ws.get(
      "generateModuleDocstring",
      DEFAULT_CONFIG.generateModuleDocstring
    ),
    placeholderSummary: ws.get("placeholders.summary", DEFAULT_CONFIG.placeholderSummary),
    placeholderDescription: ws.get(
      "placeholders.description",
      DEFAULT_CONFIG.placeholderDescription
    )
  };
}
function detectFormat() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return "google";
  for (const folder of folders) {
    const tomlPath = (0, import_path2.join)(folder.uri.fsPath, "pyproject.toml");
    if (!(0, import_fs2.existsSync)(tomlPath)) continue;
    try {
      const toml = parse((0, import_fs2.readFileSync)(tomlPath, "utf8"));
      const convention = readConvention(toml);
      if (convention) return convention;
    } catch {
    }
  }
  return "google";
}
function readConvention(toml) {
  const pydocstyle = toml?.tool?.pydocstyle;
  const c1 = pydocstyle?.convention;
  if (c1) return mapConvention(c1);
  const ruff = toml?.tool?.ruff;
  const c2 = ruff?.lint?.pydocstyle?.convention;
  if (c2) return mapConvention(c2);
  return null;
}
function mapConvention(convention) {
  switch (convention.toLowerCase()) {
    case "numpy":
      return "numpy";
    case "google":
      return "google";
    case "pep257":
      return "google";
    // closest equivalent
    default:
      return null;
  }
}

// src/commands.ts
async function generate(editor) {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  const lineNum = editor.selection.active.line;
  const result = buildDocstringForLine(lines, lineNum, cfg);
  if (!result) {
    vscode2.window.showInformationMessage(
      "Docdoc: No undocumented function or class found at cursor."
    );
    return;
  }
  const insertAt = new vscode2.Position(result.afterLine + 1, 0);
  const text = result.docText.split("\n").map((l) => l + "\n").join("");
  await editor.edit((eb) => eb.insert(insertAt, text));
}
async function generateFile(editor) {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const insertions = generateFileInsertions(lines, cfg);
  if (insertions.length === 0) {
    vscode2.window.showInformationMessage(
      "Docdoc: All functions and classes are already documented."
    );
    return;
  }
  const resultLines = applyInsertions(lines, insertions);
  const newText = resultLines.join("\n") + "\n";
  const fullRange = new vscode2.Range(
    new vscode2.Position(0, 0),
    new vscode2.Position(
      editor.document.lineCount - 1,
      editor.document.lineAt(editor.document.lineCount - 1).text.length
    )
  );
  await editor.edit((eb) => eb.replace(fullRange, newText));
}
async function update(editor) {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  const lineNum = editor.selection.active.line;
  const replacement = buildUpdateForLine(lines, lineNum, cfg);
  if (!replacement) {
    vscode2.window.showInformationMessage(
      "Docdoc: No documented function or class found at cursor."
    );
    return;
  }
  const range = new vscode2.Range(
    new vscode2.Position(replacement.startLine, 0),
    new vscode2.Position(replacement.endLine, lines[replacement.endLine]?.length ?? 0)
  );
  await editor.edit((eb) => eb.replace(range, replacement.newLines.join("\n")));
}
async function updateFile(editor) {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const ops = getUpdateOperations(lines, cfg);
  if (ops.length === 0) {
    vscode2.window.showInformationMessage("Docdoc: Nothing to update.");
    return;
  }
  const resultLines = applyReplacements(lines, ops);
  const newText = resultLines.join("\n") + "\n";
  const fullRange = new vscode2.Range(
    new vscode2.Position(0, 0),
    new vscode2.Position(
      editor.document.lineCount - 1,
      editor.document.lineAt(editor.document.lineCount - 1).text.length
    )
  );
  await editor.edit((eb) => eb.replace(fullRange, newText));
}
async function convertFormat(editor) {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  const lineNum = editor.selection.active.line;
  const replacement = buildUpdateForLine(lines, lineNum, cfg);
  if (!replacement) {
    vscode2.window.showInformationMessage(
      "Docdoc: No documented function or class found at cursor."
    );
    return;
  }
  const range = new vscode2.Range(
    new vscode2.Position(replacement.startLine, 0),
    new vscode2.Position(replacement.endLine, lines[replacement.endLine]?.length ?? 0)
  );
  await editor.edit((eb) => eb.replace(range, replacement.newLines.join("\n")));
}
async function convertFileFormat(editor) {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const ops = getUpdateOperations(lines, cfg);
  if (ops.length === 0) {
    vscode2.window.showInformationMessage("Docdoc: No documented functions or classes found.");
    return;
  }
  const resultLines = applyReplacements(lines, ops);
  const newText = resultLines.join("\n") + "\n";
  const fullRange = new vscode2.Range(
    new vscode2.Position(0, 0),
    new vscode2.Position(
      editor.document.lineCount - 1,
      editor.document.lineAt(editor.document.lineCount - 1).text.length
    )
  );
  await editor.edit((eb) => eb.replace(fullRange, newText));
}
async function generateAndUpdateFile(editor) {
  const cfg = getConfig();
  const lines = editor.document.getText().split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const { generated, updated, ops } = getGenerateAndUpdateOperations(lines, cfg);
  if (ops.length === 0) {
    vscode2.window.showInformationMessage("Docdoc: Nothing to do.");
    return;
  }
  const resultLines = applyGenerateAndUpdateOperations(lines, ops);
  const newText = resultLines.join("\n") + "\n";
  const fullRange = new vscode2.Range(
    new vscode2.Position(0, 0),
    new vscode2.Position(
      editor.document.lineCount - 1,
      editor.document.lineAt(editor.document.lineCount - 1).text.length
    )
  );
  await editor.edit((eb) => eb.replace(fullRange, newText));
  const parts = [];
  if (generated) parts.push(`${generated} generated`);
  if (updated) parts.push(`${updated} updated`);
  vscode2.window.showInformationMessage(`Docdoc: ${parts.join(", ")}.`);
}

// src/trigger.ts
var vscode3 = __toESM(require("vscode"));
var DocstringTrigger = class {
  provideInlineCompletionItems(document, position) {
    const lineText = document.lineAt(position.line).text;
    const prefix = lineText.slice(0, position.character).trimStart();
    const isDouble = prefix === '"""';
    const isSingle = prefix === "'''";
    if (!isDouble && !isSingle) return null;
    const cfg = getConfig();
    if (cfg.quoteStyle === "double" && !isDouble) return null;
    if (cfg.quoteStyle === "single" && !isSingle) return null;
    const lines = document.getText().split("\n");
    const result = buildSnippetForLine(lines, position.line, cfg);
    if (!result) return null;
    const quote = isDouble ? '"""' : "'''";
    const quoteIdx = result.snippet.indexOf(quote);
    const snippetBodyIndent = result.snippet.slice(0, quoteIdx);
    const triggerIndent = lineText.slice(0, lineText.length - lineText.trimStart().length);
    let snippet = result.snippet;
    if (snippetBodyIndent !== triggerIndent) {
      const snippetLines = snippet.split("\n");
      for (let i = 0; i < snippetLines.length; i++) {
        if (snippetBodyIndent === "") {
          snippetLines[i] = triggerIndent + snippetLines[i];
        } else if (snippetLines[i].startsWith(snippetBodyIndent)) {
          snippetLines[i] = triggerIndent + snippetLines[i].slice(snippetBodyIndent.length);
        }
      }
      snippet = snippetLines.join("\n");
    }
    const lineStart = new vscode3.Position(position.line, 0);
    const lineEnd = new vscode3.Position(position.line, lineText.length);
    const snippetItem = new vscode3.InlineCompletionItem(
      new vscode3.SnippetString(snippet),
      new vscode3.Range(lineStart, lineEnd)
    );
    return new vscode3.InlineCompletionList([snippetItem]);
  }
};

// src/codeAction.ts
var vscode4 = __toESM(require("vscode"));
var GenerateDocstringActionProvider = class {
  provideCodeActions(document, range) {
    const line = range.start.line;
    const lines = document.getText().split("\n");
    const code = lines.join("\n");
    let tree;
    try {
      tree = parseCode(code);
    } catch {
      return null;
    }
    if (!tree) return null;
    const found = findDefNodeAtLine(tree, line);
    if (!found) return null;
    if (hasDocstring(found.def)) return null;
    const action = new vscode4.CodeAction("Generate docstring", vscode4.CodeActionKind.QuickFix);
    action.command = {
      command: "docdoc.generate",
      title: "Generate docstring"
    };
    return [action];
  }
};

// src/onSave.ts
var vscode5 = __toESM(require("vscode"));
async function processDocument(document) {
  if (document.languageId !== "python") return;
  const cfg = getConfig();
  if (!cfg || !vscode5.workspace.getConfiguration("docdoc").get("onSave.enable")) {
    return;
  }
  const editor = vscode5.window.visibleTextEditors.find((e) => e.document === document);
  if (!editor) return;
  const lines = document.getText().split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const insertions = generateFileInsertions(lines, cfg);
  if (insertions.length === 0) return;
  const resultLines = applyInsertions(lines, insertions);
  const newText = resultLines.join("\n") + "\n";
  const fullRange = new vscode5.Range(
    new vscode5.Position(0, 0),
    new vscode5.Position(
      document.lineCount - 1,
      document.lineAt(document.lineCount - 1).text.length
    )
  );
  await editor.edit((eb) => eb.replace(fullRange, newText));
}
function registerOnSaveHandler(context) {
  const disposable = vscode5.workspace.onDidSaveTextDocument(async (document) => {
    await processDocument(document);
  });
  const notebookDisposable = vscode5.workspace.onDidSaveNotebookDocument(async (notebook) => {
    for (const cell of notebook.notebook.getCells()) {
      if (cell.kind === vscode5.NotebookCellKind.Code && cell.document.languageId === "python") {
        await processDocument(cell.document);
      }
    }
  });
  context.subscriptions.push(disposable, notebookDisposable);
}

// src/tools.ts
var vscode6 = __toESM(require("vscode"));
async function readFileContent(uriOrPath) {
  let uri;
  if (typeof uriOrPath === "string") {
    uri = uriOrPath.startsWith("file://") ? vscode6.Uri.parse(uriOrPath) : vscode6.Uri.file(uriOrPath);
  } else {
    uri = uriOrPath;
  }
  const bytes = await vscode6.workspace.fs.readFile(uri);
  const content = new TextDecoder().decode(bytes);
  const lines = content.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return { uri, content, lines };
}
async function writeFileContent(uri, newContent) {
  const doc = vscode6.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (doc) {
    const editor = vscode6.window.visibleTextEditors.find((e) => e.document === doc);
    if (editor) {
      const fullRange = new vscode6.Range(
        new vscode6.Position(0, 0),
        new vscode6.Position(doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length)
      );
      await editor.edit((eb) => eb.replace(fullRange, newContent));
      return;
    }
  }
  await vscode6.workspace.fs.writeFile(uri, new TextEncoder().encode(newContent));
}
function resolveConfig2(overrides) {
  const base = getConfig();
  return overrides?.format ? { ...base, format: overrides.format } : base;
}
async function processFiles(files, processor) {
  const results = [];
  for (const fileUri of files) {
    try {
      const result = await processor(fileUri);
      results.push(result);
    } catch (e) {
      results.push({
        uri: fileUri,
        result: null,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }
  return results;
}
var GenerateDocstringTool = class {
  async invoke(options, _token) {
    const { uri, files, line, format } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode6.LanguageModelToolResult([
        new vscode6.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s)."
        )
      ]);
    }
    const cfg = resolveConfig2({ format });
    const targetLine = line ?? 0;
    const results = await processFiles(targetFiles, async (fileUri) => {
      const { uri: parsedUri, lines } = await readFileContent(fileUri);
      const result = buildDocstringForLine(lines, targetLine, cfg);
      if (!result) {
        return {
          uri: fileUri,
          result: null,
          error: `No undocumented function or class found at line ${targetLine}.`
        };
      }
      const insertions = [{ afterLine: result.afterLine, lines: result.docText.split("\n") }];
      const newLines = applyInsertions(lines, insertions);
      const newContent = newLines.join("\n") + "\n";
      await writeFileContent(parsedUri, newContent);
      return { uri: fileUri, result: `Generated docstring at line ${result.afterLine + 1}.` };
    });
    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results.filter((r) => r.error).map((r) => `- ${r.uri}: ${r.error}`).join("\n");
    const successLines = results.filter((r) => !r.error).map((r) => `- ${r.uri}: ${r.result}`).join("\n");
    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `

Successes:
${successLines}`;
    if (errorLines) message += `

Errors:
${errorLines}`;
    return new vscode6.LanguageModelToolResult([new vscode6.LanguageModelTextPart(message)]);
  }
};
var GenerateAllDocstringsTool = class {
  async invoke(options, _token) {
    const { uri, files, format } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode6.LanguageModelToolResult([
        new vscode6.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s)."
        )
      ]);
    }
    const cfg = resolveConfig2({ format });
    const results = await processFiles(targetFiles, async (fileUri) => {
      const { uri: parsedUri, lines } = await readFileContent(fileUri);
      const insertions = generateFileInsertions(lines, cfg);
      if (insertions.length === 0) {
        return { uri: fileUri, result: "Already documented." };
      }
      const newLines = applyInsertions(lines, insertions);
      const newContent = newLines.join("\n") + "\n";
      await writeFileContent(parsedUri, newContent);
      return { uri: fileUri, result: `Generated ${insertions.length} docstring(s).` };
    });
    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results.filter((r) => r.error).map((r) => `- ${r.uri}: ${r.error}`).join("\n");
    const successLines = results.filter((r) => !r.error).map((r) => `- ${r.uri}: ${r.result}`).join("\n");
    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `

Successes:
${successLines}`;
    if (errorLines) message += `

Errors:
${errorLines}`;
    return new vscode6.LanguageModelToolResult([new vscode6.LanguageModelTextPart(message)]);
  }
};
var UpdateDocstringTool = class {
  async invoke(options, _token) {
    const { uri, files, line } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode6.LanguageModelToolResult([
        new vscode6.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s)."
        )
      ]);
    }
    const cfg = getConfig();
    const targetLine = line ?? 0;
    const results = await processFiles(targetFiles, async (fileUri) => {
      const { uri: parsedUri, lines } = await readFileContent(fileUri);
      const replacement = buildUpdateForLine(lines, targetLine, cfg);
      if (!replacement) {
        return {
          uri: fileUri,
          result: null,
          error: `No documented function or class found near line ${targetLine}.`
        };
      }
      const newLines = applyReplacements(lines, [replacement]);
      const newContent = newLines.join("\n") + "\n";
      await writeFileContent(parsedUri, newContent);
      return {
        uri: fileUri,
        result: `Updated docstring spanning lines ${replacement.startLine + 1}-${replacement.endLine + 1}.`
      };
    });
    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results.filter((r) => r.error).map((r) => `- ${r.uri}: ${r.error}`).join("\n");
    const successLines = results.filter((r) => !r.error).map((r) => `- ${r.uri}: ${r.result}`).join("\n");
    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `

Successes:
${successLines}`;
    if (errorLines) message += `

Errors:
${errorLines}`;
    return new vscode6.LanguageModelToolResult([new vscode6.LanguageModelTextPart(message)]);
  }
};
var UpdateAllDocstringsTool = class {
  async invoke(options, _token) {
    const { uri, files } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode6.LanguageModelToolResult([
        new vscode6.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s)."
        )
      ]);
    }
    const cfg = getConfig();
    const results = await processFiles(targetFiles, async (fileUri) => {
      const { uri: parsedUri, lines } = await readFileContent(fileUri);
      const ops = getUpdateOperations(lines, cfg);
      if (ops.length === 0) {
        return { uri: fileUri, result: "No docstrings to update." };
      }
      const newLines = applyReplacements(lines, ops);
      const newContent = newLines.join("\n") + "\n";
      await writeFileContent(parsedUri, newContent);
      return { uri: fileUri, result: `Updated ${ops.length} docstring(s).` };
    });
    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results.filter((r) => r.error).map((r) => `- ${r.uri}: ${r.error}`).join("\n");
    const successLines = results.filter((r) => !r.error).map((r) => `- ${r.uri}: ${r.result}`).join("\n");
    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `

Successes:
${successLines}`;
    if (errorLines) message += `

Errors:
${errorLines}`;
    return new vscode6.LanguageModelToolResult([new vscode6.LanguageModelTextPart(message)]);
  }
};
var ConvertDocstringTool = class {
  async invoke(options, _token) {
    const { uri, files, toFormat, line } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode6.LanguageModelToolResult([
        new vscode6.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s)."
        )
      ]);
    }
    const cfg = { ...getConfig(), format: toFormat };
    const targetLine = line ?? 0;
    const results = await processFiles(targetFiles, async (fileUri) => {
      const { uri: parsedUri, lines } = await readFileContent(fileUri);
      const replacement = buildUpdateForLine(lines, targetLine, cfg);
      if (!replacement) {
        return {
          uri: fileUri,
          result: null,
          error: `No documented function or class found near line ${targetLine}.`
        };
      }
      const newLines = applyReplacements(lines, [replacement]);
      const newContent = newLines.join("\n") + "\n";
      await writeFileContent(parsedUri, newContent);
      return { uri: fileUri, result: `Converted docstring to ${toFormat} format.` };
    });
    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results.filter((r) => r.error).map((r) => `- ${r.uri}: ${r.error}`).join("\n");
    const successLines = results.filter((r) => !r.error).map((r) => `- ${r.uri}: ${r.result}`).join("\n");
    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `

Successes:
${successLines}`;
    if (errorLines) message += `

Errors:
${errorLines}`;
    return new vscode6.LanguageModelToolResult([new vscode6.LanguageModelTextPart(message)]);
  }
};
var ConvertAllDocstringsTool = class {
  async invoke(options, _token) {
    const { uri, files, toFormat } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode6.LanguageModelToolResult([
        new vscode6.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s)."
        )
      ]);
    }
    const cfg = { ...getConfig(), format: toFormat };
    const results = await processFiles(targetFiles, async (fileUri) => {
      const { uri: parsedUri, lines } = await readFileContent(fileUri);
      const ops = getUpdateOperations(lines, cfg);
      if (ops.length === 0) {
        return { uri: fileUri, result: "No docstrings to convert." };
      }
      const newLines = applyReplacements(lines, ops);
      const newContent = newLines.join("\n") + "\n";
      await writeFileContent(parsedUri, newContent);
      return {
        uri: fileUri,
        result: `Converted ${ops.length} docstring(s) to ${toFormat} format.`
      };
    });
    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results.filter((r) => r.error).map((r) => `- ${r.uri}: ${r.error}`).join("\n");
    const successLines = results.filter((r) => !r.error).map((r) => `- ${r.uri}: ${r.result}`).join("\n");
    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `

Successes:
${successLines}`;
    if (errorLines) message += `

Errors:
${errorLines}`;
    return new vscode6.LanguageModelToolResult([new vscode6.LanguageModelTextPart(message)]);
  }
};
var GenerateAndUpdateAllDocstringsTool = class {
  async invoke(options, _token) {
    const { uri, files, format } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode6.LanguageModelToolResult([
        new vscode6.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s)."
        )
      ]);
    }
    const cfg = resolveConfig2({ format });
    const results = await processFiles(targetFiles, async (fileUri) => {
      const { uri: parsedUri, lines } = await readFileContent(fileUri);
      const { generated, updated, ops } = getGenerateAndUpdateOperations(lines, cfg);
      if (ops.length === 0) {
        return { uri: fileUri, result: "Nothing to do." };
      }
      const newLines = applyGenerateAndUpdateOperations(lines, ops);
      const newContent = newLines.join("\n") + "\n";
      await writeFileContent(parsedUri, newContent);
      const parts = [];
      if (generated) parts.push(`${generated} generated`);
      if (updated) parts.push(`${updated} updated`);
      return { uri: fileUri, result: `Docstrings ${parts.join(", ")}.` };
    });
    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results.filter((r) => r.error).map((r) => `- ${r.uri}: ${r.error}`).join("\n");
    const successLines = results.filter((r) => !r.error).map((r) => `- ${r.uri}: ${r.result}`).join("\n");
    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `

Successes:
${successLines}`;
    if (errorLines) message += `

Errors:
${errorLines}`;
    return new vscode6.LanguageModelToolResult([new vscode6.LanguageModelTextPart(message)]);
  }
};

// src/extension.ts
async function activate(context) {
  try {
    await initParser();
  } catch (err) {
    vscode7.window.showErrorMessage(`Docdoc: Failed to initialise parser \u2014 ${String(err)}`);
    return;
  }
  const PYTHON_SELECTOR = [
    { language: "python" },
    { language: "python", notebookType: "jupyter-notebook" },
    { language: "python", notebookType: "interactive" }
  ];
  context.subscriptions.push(
    vscode7.languages.registerInlineCompletionItemProvider(PYTHON_SELECTOR, new DocstringTrigger())
  );
  context.subscriptions.push(
    vscode7.languages.registerCodeActionsProvider(
      PYTHON_SELECTOR,
      new GenerateDocstringActionProvider(),
      { providedCodeActionKinds: [vscode7.CodeActionKind.QuickFix] }
    )
  );
  const reg = (id, handler) => vscode7.commands.registerTextEditorCommand(id, handler);
  context.subscriptions.push(
    reg("docdoc.generate", generate),
    reg("docdoc.generateFile", generateFile),
    reg("docdoc.update", update),
    reg("docdoc.updateFile", updateFile),
    reg("docdoc.generateAndUpdateFile", generateAndUpdateFile),
    reg("docdoc.convertFormat", convertFormat),
    reg("docdoc.convertFileFormat", convertFileFormat)
  );
  context.subscriptions.push(
    vscode7.lm.registerTool("docdoc-generateDocstring", new GenerateDocstringTool()),
    vscode7.lm.registerTool("docdoc-generateAllDocstrings", new GenerateAllDocstringsTool()),
    vscode7.lm.registerTool("docdoc-updateDocstring", new UpdateDocstringTool()),
    vscode7.lm.registerTool("docdoc-updateAllDocstrings", new UpdateAllDocstringsTool()),
    vscode7.lm.registerTool("docdoc-generateAndUpdateAllDocstrings", new GenerateAndUpdateAllDocstringsTool()),
    vscode7.lm.registerTool("docdoc-convertDocstring", new ConvertDocstringTool()),
    vscode7.lm.registerTool("docdoc-convertAllDocstrings", new ConvertAllDocstringsTool())
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
/*! Bundled license information:

smol-toml/dist/error.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)

smol-toml/dist/util.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)

smol-toml/dist/date.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)

smol-toml/dist/primitive.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)

smol-toml/dist/extract.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)

smol-toml/dist/struct.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)

smol-toml/dist/parse.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)

smol-toml/dist/stringify.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)

smol-toml/dist/index.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)
*/
//# sourceMappingURL=extension.js.map
