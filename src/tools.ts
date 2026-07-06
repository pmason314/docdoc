/**
 * Language Model Tool implementations.
 *
 * Exposes docstring generation and update operations as tools that can be
 * invoked by any LLM/agent running inside VS Code (Copilot Chat, Continue,
 * Cline, Roo, etc.).
 */
import * as vscode from "vscode";
import { getConfig } from "./config.js";
import {
  buildDocstringForLine,
  buildUpdateForLine,
  generateFileInsertions,
  applyInsertions,
  applyGenerateAndUpdateOperations,
  getUpdateOperations,
  getGenerateAndUpdateOperations,
  applyReplacements,
} from "./parser/index.js";
import type { BuildConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Helper: read file content from a URI or file path
// ---------------------------------------------------------------------------

async function readFileContent(
  uriOrPath: string | vscode.Uri,
): Promise<{ uri: vscode.Uri; content: string; lines: string[] }> {
  let uri: vscode.Uri;
  if (typeof uriOrPath === "string") {
    // Accept both file:// URIs and plain paths
    uri = uriOrPath.startsWith("file://")
      ? vscode.Uri.parse(uriOrPath)
      : vscode.Uri.file(uriOrPath);
  } else {
    uri = uriOrPath;
  }

  const bytes = await vscode.workspace.fs.readFile(uri);
  const content = new TextDecoder().decode(bytes);
  const lines = content.split("\n");
  // Remove trailing empty element from final newline
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return { uri, content, lines };
}

// ---------------------------------------------------------------------------
// Helper: write updated content back to the file
// ---------------------------------------------------------------------------

async function writeFileContent(uri: vscode.Uri, newContent: string): Promise<void> {
  // If the file is open in an editor, use the editor API (preserves undo stack).
  const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (doc) {
    const editor = vscode.window.visibleTextEditors.find((e) => e.document === doc);
    if (editor) {
      const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length),
      );
      await editor.edit((eb) => eb.replace(fullRange, newContent));
      return;
    }
  }

  // Fallback: write directly via the file system API.
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(newContent));
}

// ---------------------------------------------------------------------------
// Helper: resolve config, allowing the caller to override format
// ---------------------------------------------------------------------------

function resolveConfig(overrides?: { format?: "google" | "numpy" | "sphinx" }): BuildConfig {
  const base = getConfig();
  return overrides?.format ? { ...base, format: overrides.format } : base;
}

// ---------------------------------------------------------------------------
// Helper: process a list of files and aggregate results
// ---------------------------------------------------------------------------

async function processFiles<T>(
  files: string[],
  processor: (uri: string) => Promise<{ uri: string; result: T; error?: string }>,
): Promise<{ uri: string; result: T; error?: string }[]> {
  const results: { uri: string; result: T; error?: string }[] = [];
  for (const fileUri of files) {
    try {
      const result = await processor(fileUri);
      results.push(result);
    } catch (e) {
      results.push({
        uri: fileUri,
        result: null as unknown as T,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Tool: Generate docstring for a single function/class
// ---------------------------------------------------------------------------

export class GenerateDocstringTool implements vscode.LanguageModelTool<{
  uri?: string;
  files?: string[];
  line?: number;
  format?: "google" | "numpy" | "sphinx";
}> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{
      uri?: string;
      files?: string[];
      line?: number;
      format?: "google" | "numpy" | "sphinx";
    }>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { uri, files, line, format } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s).",
        ),
      ]);
    }

    const cfg = resolveConfig({ format });
    const targetLine = line ?? 0;

    const results = await processFiles(targetFiles, async (fileUri) => {
      const { uri: parsedUri, lines } = await readFileContent(fileUri);
      const result = buildDocstringForLine(lines, targetLine, cfg);
      if (!result) {
        return {
          uri: fileUri,
          result: null,
          error: `No undocumented function or class found at line ${targetLine}.`,
        };
      }

      const insertions = [{ afterLine: result.afterLine, lines: result.docText.split("\n") }];
      const newLines = applyInsertions(lines, insertions);
      const newContent = newLines.join("\n") + "\n";
      await writeFileContent(parsedUri, newContent);
      return { uri: fileUri, result: `Generated docstring at line ${result.afterLine + 1}.` };
    });

    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results
      .filter((r) => r.error)
      .map((r) => `- ${r.uri}: ${r.error}`)
      .join("\n");
    const successLines = results
      .filter((r) => !r.error)
      .map((r) => `- ${r.uri}: ${r.result}`)
      .join("\n");

    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `\n\nSuccesses:\n${successLines}`;
    if (errorLines) message += `\n\nErrors:\n${errorLines}`;

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(message)]);
  }
}

// ---------------------------------------------------------------------------
// Tool: Generate all missing docstrings in a file
// ---------------------------------------------------------------------------

export class GenerateAllDocstringsTool implements vscode.LanguageModelTool<{
  uri?: string;
  files?: string[];
  format?: "google" | "numpy" | "sphinx";
}> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{
      uri?: string;
      files?: string[];
      format?: "google" | "numpy" | "sphinx";
    }>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { uri, files, format } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s).",
        ),
      ]);
    }

    const cfg = resolveConfig({ format });

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
    const errorLines = results
      .filter((r) => r.error)
      .map((r) => `- ${r.uri}: ${r.error}`)
      .join("\n");
    const successLines = results
      .filter((r) => !r.error)
      .map((r) => `- ${r.uri}: ${r.result}`)
      .join("\n");

    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `\n\nSuccesses:\n${successLines}`;
    if (errorLines) message += `\n\nErrors:\n${errorLines}`;

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(message)]);
  }
}

// ---------------------------------------------------------------------------
// Tool: Update docstring for a single function/class
// ---------------------------------------------------------------------------

export class UpdateDocstringTool implements vscode.LanguageModelTool<{
  uri?: string;
  files?: string[];
  line?: number;
}> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{
      uri?: string;
      files?: string[];
      line?: number;
    }>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { uri, files, line } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s).",
        ),
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
          error: `No documented function or class found near line ${targetLine}.`,
        };
      }

      const newLines = applyReplacements(lines, [replacement]);
      const newContent = newLines.join("\n") + "\n";
      await writeFileContent(parsedUri, newContent);
      return {
        uri: fileUri,
        result: `Updated docstring spanning lines ${replacement.startLine + 1}-${replacement.endLine + 1}.`,
      };
    });

    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results
      .filter((r) => r.error)
      .map((r) => `- ${r.uri}: ${r.error}`)
      .join("\n");
    const successLines = results
      .filter((r) => !r.error)
      .map((r) => `- ${r.uri}: ${r.result}`)
      .join("\n");

    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `\n\nSuccesses:\n${successLines}`;
    if (errorLines) message += `\n\nErrors:\n${errorLines}`;

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(message)]);
  }
}

// ---------------------------------------------------------------------------
// Tool: Update all docstrings in a file
// ---------------------------------------------------------------------------

export class UpdateAllDocstringsTool implements vscode.LanguageModelTool<{
  uri?: string;
  files?: string[];
}> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{
      uri?: string;
      files?: string[];
    }>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { uri, files } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s).",
        ),
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
    const errorLines = results
      .filter((r) => r.error)
      .map((r) => `- ${r.uri}: ${r.error}`)
      .join("\n");
    const successLines = results
      .filter((r) => !r.error)
      .map((r) => `- ${r.uri}: ${r.result}`)
      .join("\n");

    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `\n\nSuccesses:\n${successLines}`;
    if (errorLines) message += `\n\nErrors:\n${errorLines}`;

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(message)]);
  }
}

// ---------------------------------------------------------------------------
// Tool: Convert docstring format for a single function/class
// ---------------------------------------------------------------------------

export class ConvertDocstringTool implements vscode.LanguageModelTool<{
  uri?: string;
  files?: string[];
  toFormat: "google" | "numpy" | "sphinx";
  line?: number;
}> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{
      uri?: string;
      files?: string[];
      toFormat: "google" | "numpy" | "sphinx";
      line?: number;
    }>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { uri, files, toFormat, line } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s).",
        ),
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
          error: `No documented function or class found near line ${targetLine}.`,
        };
      }

      const newLines = applyReplacements(lines, [replacement]);
      const newContent = newLines.join("\n") + "\n";
      await writeFileContent(parsedUri, newContent);
      return { uri: fileUri, result: `Converted docstring to ${toFormat} format.` };
    });

    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results
      .filter((r) => r.error)
      .map((r) => `- ${r.uri}: ${r.error}`)
      .join("\n");
    const successLines = results
      .filter((r) => !r.error)
      .map((r) => `- ${r.uri}: ${r.result}`)
      .join("\n");

    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `\n\nSuccesses:\n${successLines}`;
    if (errorLines) message += `\n\nErrors:\n${errorLines}`;

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(message)]);
  }
}

// ---------------------------------------------------------------------------
// Tool: Convert all docstrings in a file to a different format
// ---------------------------------------------------------------------------

export class ConvertAllDocstringsTool implements vscode.LanguageModelTool<{
  uri?: string;
  files?: string[];
  toFormat: "google" | "numpy" | "sphinx";
}> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{
      uri?: string;
      files?: string[];
      toFormat: "google" | "numpy" | "sphinx";
    }>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { uri, files, toFormat } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s).",
        ),
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
        result: `Converted ${ops.length} docstring(s) to ${toFormat} format.`,
      };
    });

    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results
      .filter((r) => r.error)
      .map((r) => `- ${r.uri}: ${r.error}`)
      .join("\n");
    const successLines = results
      .filter((r) => !r.error)
      .map((r) => `- ${r.uri}: ${r.result}`)
      .join("\n");

    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `\n\nSuccesses:\n${successLines}`;
    if (errorLines) message += `\n\nErrors:\n${errorLines}`;

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(message)]);
  }
}

// -------
// Tool: Generate and update all docstrings in a file (combined)
// -------

export class GenerateAndUpdateAllDocstringsTool implements vscode.LanguageModelTool<{
  uri?: string;
  files?: string[];
  format?: "google" | "numpy" | "sphinx";
}> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{
      uri?: string;
      files?: string[];
      format?: "google" | "numpy" | "sphinx";
    }>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { uri, files, format } = options.input;
    const targetFiles = files || (uri ? [uri] : []);
    if (targetFiles.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          "Provide either `uri` or `files` to specify target file(s).",
        ),
      ]);
    }

    const cfg = resolveConfig({ format });

    const results = await processFiles(targetFiles, async (fileUri) => {
      const { uri: parsedUri, lines } = await readFileContent(fileUri);
      const { generated, updated, ops } = getGenerateAndUpdateOperations(lines, cfg);
      if (ops.length === 0) {
        return { uri: fileUri, result: "Nothing to do." };
      }

      const newLines = applyGenerateAndUpdateOperations(lines, ops);
      const newContent = newLines.join("\n") + "\n";
      await writeFileContent(parsedUri, newContent);
      const parts: string[] = [];
      if (generated) parts.push(`${generated} generated`);
      if (updated) parts.push(`${updated} updated`);
      return { uri: fileUri, result: `Docstrings ${parts.join(", ")}.` };
    });

    const successCount = results.filter((r) => !r.error).length;
    const errorLines = results
      .filter((r) => r.error)
      .map((r) => `- ${r.uri}: ${r.error}`)
      .join("\n");
    const successLines = results
      .filter((r) => !r.error)
      .map((r) => `- ${r.uri}: ${r.result}`)
      .join("\n");

    let message = `Processed ${targetFiles.length} file(s), ${successCount} succeeded.`;
    if (successLines) message += `\n\nSuccesses:\n${successLines}`;
    if (errorLines) message += `\n\nErrors:\n${errorLines}`;

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(message)]);
  }
}
