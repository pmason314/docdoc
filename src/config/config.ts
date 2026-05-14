import type { Config, DocstringFormat } from "../types.js";
import { DEFAULT_CONFIG } from "../types.js";
import {
  detectFormatFromPyprojectToml,
  detectFormatFromRuffToml,
  detectFormatFromSetupCfg,
} from "./formatDetector.js";
import { detectRuffStyleFromPyprojectToml, detectRuffStyleFromRuffToml } from "./ruffStyleDetector.js";

/**
 * Raw VS Code workspace configuration values (the shape passed in from the VS Code layer).
 * This interface mirrors the settings in package.json contributes.configuration.
 */
export interface RawWorkspaceConfig {
  format: string;
  quoteStyle: string;
  "trigger.tripleQuote": boolean;
  "trigger.codeAction": boolean;
  "onSave.enable": boolean;
  includeTypesFromAnnotations: boolean;
  includeDefaults: boolean;
  includeExtendedSummary: boolean;
  "returns.skipNone": boolean;
  "returns.requireAnnotation": boolean;
  detectGenerators: boolean;
  "raises.useSubprocess": boolean;
  "raises.useSimpleScan": boolean;
  mergeInitParams: boolean;
  includeClassAttributes: boolean;
  "update.removeStaleParams": boolean;
  "placeholders.summary": string;
  "placeholders.description": string;
  pythonPath: string;
  "ai.generateSummary": boolean;
  "ai.generateParamDescriptions": boolean;
  "ai.generateReturnDescription": boolean;
  "ai.includeBodyContext": boolean;
  "ai.maxBodyTokens": number;
  "ai.modelFamily": string;
}

/**
 * File contents for configuration files found in the workspace.
 * Pass null if the file was not found.
 */
export interface ConfigFileContents {
  pyprojectToml: string | null;
  ruffToml: string | null;
  setupCfg: string | null;
}

/**
 * Resolve the full Config from raw workspace settings and config file contents.
 * This function is pure and has no VS Code API dependency.
 */
export async function resolveConfig(
  raw: RawWorkspaceConfig,
  files: ConfigFileContents,
): Promise<Config> {
  const config: Config = { ...DEFAULT_CONFIG };

  // --- Format ---
  if (raw.format && isValidFormat(raw.format)) {
    config.format = raw.format;
  } else {
    config.format = (await detectFormat(files)) ?? "google";
  }

  // --- Quote style ---
  if (raw.quoteStyle === "single" || raw.quoteStyle === "double") {
    config.quoteStyle = raw.quoteStyle;
  }

  // --- Triggers ---
  config.trigger = {
    tripleQuote: raw["trigger.tripleQuote"],
    codeAction: raw["trigger.codeAction"],
  };
  config.onSave = {
    enable: raw["onSave.enable"],
  };

  // --- Parameters ---
  config.includeTypesFromAnnotations = raw.includeTypesFromAnnotations;
  config.includeDefaults = raw.includeDefaults;
  config.includeExtendedSummary = raw.includeExtendedSummary;

  // --- Returns ---
  config.returns = {
    skipNone: raw["returns.skipNone"],
    requireAnnotation: raw["returns.requireAnnotation"],
  };
  config.detectGenerators = raw.detectGenerators;

  // --- Raises ---
  config.raises = {
    useSubprocess: raw["raises.useSubprocess"],
    useSimpleScan: raw["raises.useSimpleScan"],
  };

  // --- Classes ---
  config.mergeInitParams = raw.mergeInitParams;
  config.includeClassAttributes = raw.includeClassAttributes;

  // --- Update ---
  config.update = {
    removeStaleParams: raw["update.removeStaleParams"],
  };

  // --- Placeholders ---
  config.placeholders = {
    summary: raw["placeholders.summary"],
    description: raw["placeholders.description"],
  };

  // --- Python ---
  config.pythonPath = raw.pythonPath;

  // --- AI ---
  config.ai = {
    generateSummary: raw["ai.generateSummary"],
    generateParamDescriptions: raw["ai.generateParamDescriptions"],
    generateReturnDescription: raw["ai.generateReturnDescription"],
    includeBodyContext: raw["ai.includeBodyContext"],
    maxBodyTokens: raw["ai.maxBodyTokens"],
    modelFamily: raw["ai.modelFamily"],
  };

  // --- Ruff style ---
  config.ruff = await detectRuffStyle(files);

  return config;
}

function isValidFormat(value: string): value is DocstringFormat {
  return value === "google" || value === "numpy" || value === "sphinx";
}

/**
 * Detect format from config files in priority order.
 */
async function detectFormat(files: ConfigFileContents): Promise<DocstringFormat | null> {
  if (files.pyprojectToml) {
    const format = await detectFormatFromPyprojectToml(files.pyprojectToml);
    if (format) return format;
  }
  if (files.ruffToml) {
    const format = await detectFormatFromRuffToml(files.ruffToml);
    if (format) return format;
  }
  if (files.setupCfg) {
    const format = detectFormatFromSetupCfg(files.setupCfg);
    if (format) return format;
  }
  return null;
}

/**
 * Detect Ruff style from config files.
 */
async function detectRuffStyle(files: ConfigFileContents): Promise<Config["ruff"]> {
  if (files.pyprojectToml) {
    const style = await detectRuffStyleFromPyprojectToml(files.pyprojectToml);
    // Only return non-default if we found ruff config
    if (style.startOnNewLine !== false || style.collapseOneLiners !== true) {
      return style;
    }
  }
  if (files.ruffToml) {
    return await detectRuffStyleFromRuffToml(files.ruffToml);
  }
  return { startOnNewLine: false, collapseOneLiners: true };
}
