import { execFile } from "node:child_process";

/**
 * Detects a Python interpreter path.
 * This module's core logic (the resolution order) has no VS Code API dependency.
 * The VS Code-specific parts (reading the Python extension API) are injected via parameters.
 */

export interface InterpreterSources {
  /** Explicit path from docstringGenerator.pythonPath setting */
  explicitPath: string;
  /** Path from the ms-python.python extension API, if available */
  pythonExtensionPath: string | null;
}

/**
 * Resolve the Python interpreter path using the priority order:
 * 1. Explicit setting (docstringGenerator.pythonPath)
 * 2. ms-python.python extension API
 * 3. python3 on $PATH
 * 4. python on $PATH
 * Returns null if no interpreter is found.
 */
export async function resolveInterpreterPath(sources: InterpreterSources): Promise<string | null> {
  // 1. Explicit setting
  if (sources.explicitPath) {
    if (await isValidPython(sources.explicitPath)) {
      return sources.explicitPath;
    }
  }

  // 2. ms-python.python extension
  if (sources.pythonExtensionPath) {
    if (await isValidPython(sources.pythonExtensionPath)) {
      return sources.pythonExtensionPath;
    }
  }

  // 3. python3 on PATH
  if (await isValidPython("python3")) {
    return "python3";
  }

  // 4. python on PATH
  if (await isValidPython("python")) {
    return "python";
  }

  return null;
}

/**
 * Check if a given path/command is a valid Python interpreter
 * by attempting to run it with --version.
 */
function isValidPython(pythonPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(pythonPath, ["--version"], { timeout: 5000 }, (error) => {
      resolve(!error);
    });
  });
}
