/**
 * Read VS Code workspace settings and return a resolved BuildConfig.
 *
 * Handles `format: "auto"` by scanning pyproject.toml for a docstring
 * convention; falls back to Google if nothing is detected.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse as parseToml } from "smol-toml";
import * as vscode from "vscode";
import type { BuildConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

type ResolvedFormat = "google" | "numpy" | "sphinx";

export function getConfig(): BuildConfig {
  const ws = vscode.workspace.getConfiguration("docdoc");

  const rawFormat = ws.get<string>("format", "auto");
  const format =
    rawFormat === "auto" ? detectFormat() : ((rawFormat as ResolvedFormat) ?? "google");

  return {
    format,
    quoteStyle: ws.get<"double" | "single">("quoteStyle", DEFAULT_CONFIG.quoteStyle),
    includeTypes: ws.get<boolean>("includeTypesFromAnnotations", DEFAULT_CONFIG.includeTypes),
    includeDefaults: ws.get<boolean>("includeDefaults", DEFAULT_CONFIG.includeDefaults),
    returnsMode: ws.get<"always" | "auto">("returns.mode", DEFAULT_CONFIG.returnsMode),
    generateModuleDocstring: ws.get<boolean>(
      "generateModuleDocstring",
      DEFAULT_CONFIG.generateModuleDocstring,
    ),
    placeholderSummary: ws.get<string>("placeholders.summary", DEFAULT_CONFIG.placeholderSummary),
    placeholderDescription: ws.get<string>(
      "placeholders.description",
      DEFAULT_CONFIG.placeholderDescription,
    ),
  };
}

// ---------------------------------------------------------------------------
// Auto-detection via pyproject.toml
// ---------------------------------------------------------------------------

function detectFormat(): ResolvedFormat {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return "google";

  for (const folder of folders) {
    const tomlPath = join(folder.uri.fsPath, "pyproject.toml");
    if (!existsSync(tomlPath)) continue;

    try {
      const toml = parseToml(readFileSync(tomlPath, "utf8")) as Record<string, unknown>;
      const convention = readConvention(toml);
      if (convention) return convention;
    } catch {
      // Malformed TOML — ignore
    }
  }

  return "google";
}

function readConvention(toml: Record<string, unknown>): ResolvedFormat | null {
  // tool.pydocstyle.convention
  const pydocstyle = (toml?.tool as Record<string, unknown>)?.pydocstyle as Record<string, unknown>;
  const c1 = pydocstyle?.convention as string | undefined;
  if (c1) return mapConvention(c1);

  // tool.ruff.lint.pydocstyle.convention
  const ruff = (toml?.tool as Record<string, unknown>)?.ruff as Record<string, unknown>;
  const c2 = ((ruff?.lint as Record<string, unknown>)?.pydocstyle as Record<string, unknown>)
    ?.convention as string | undefined;
  if (c2) return mapConvention(c2);

  return null;
}

function mapConvention(convention: string): ResolvedFormat | null {
  switch (convention.toLowerCase()) {
    case "numpy":
      return "numpy";
    case "google":
      return "google";
    case "pep257":
      return "google"; // closest equivalent
    default:
      return null;
  }
}
