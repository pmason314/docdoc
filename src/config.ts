import * as vscode from "vscode";
import {
  DEFAULT_OPTIONS,
  type DocstringFormat,
  type DocstringOptions,
  type ReturnMode,
} from "./parser";

export function readConfig(resource?: vscode.Uri): DocstringOptions {
  const cfg = vscode.workspace.getConfiguration("docdoc", resource);

  const quoteStyle = cfg.get<string>("quoteStyle", "double");
  const quoteChar = quoteStyle === "single" ? "'''" : '"""';

  return {
    quoteChar,
    format: cfg.get<DocstringFormat>("format", DEFAULT_OPTIONS.format),
    includeTypes: cfg.get<boolean>("includeTypesFromAnnotations", DEFAULT_OPTIONS.includeTypes),
    includeDefaults: cfg.get<boolean>("includeDefaults", DEFAULT_OPTIONS.includeDefaults),
    returnsMode: cfg.get<ReturnMode>("returns.mode", DEFAULT_OPTIONS.returnsMode),
    summaryPlaceholder: cfg.get<string>("placeholders.summary", DEFAULT_OPTIONS.summaryPlaceholder),
    descPlaceholder: cfg.get<string>("placeholders.description", DEFAULT_OPTIONS.descPlaceholder),
    generateModuleDocstring: cfg.get<boolean>(
      "generateModuleDocstring",
      DEFAULT_OPTIONS.generateModuleDocstring,
    ),
  };
}
