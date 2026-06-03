/**
 * Merge an existing ParsedDocstring with a fresh Signature.
 *
 * Rules:
 *   - Summary and extended summary are preserved verbatim.
 *   - Args are reordered to match signature order; existing descriptions kept;
 *     new params get placeholder descriptions; stale params are removed.
 *   - Returns/Yields: type is updated from annotation; description preserved.
 *     A Returns section is added when absent, per returnsMode.
 *   - Raises: existing entries are preserved unchanged.
 *   - Custom sections (Notes, Examples, …) are preserved verbatim.
 */
import type { BuildConfig, Param, Signature } from "../types.js";
import type { ParsedDocstring, ParsedParam, ParsedReturn } from "./types.js";

export function mergeDocstring(
  parsed: ParsedDocstring,
  sig: Signature,
  cfg: BuildConfig,
): ParsedDocstring {
  const args = mergeArgs(parsed.args, sig.params, cfg);
  const { returns, yields } = mergeReturns(parsed, sig, cfg);

  return {
    ...parsed,
    args,
    returns,
    yields,
    // Raises and custom sections are preserved as-is
  };
}

// ---------------------------------------------------------------------------
// Args reconciliation
// ---------------------------------------------------------------------------

function mergeArgs(existing: ParsedParam[], params: Param[], cfg: BuildConfig): ParsedParam[] {
  const existingMap = new Map(existing.map((p) => [p.name, p]));

  return params.map((param): ParsedParam => {
    const prev = existingMap.get(param.name);
    const type = cfg.includeTypes ? param.type : undefined;

    if (prev) {
      return { ...prev, type };
    }

    // New parameter — build a placeholder description
    const kind = param.kind;
    let desc = cfg.placeholderDescription;
    if (cfg.includeDefaults && param.default !== undefined) {
      desc += `. Defaults to ${param.default}.`;
    }
    return { name: param.name, type, description: desc, kind };
  });
}

// ---------------------------------------------------------------------------
// Returns / Yields reconciliation
// ---------------------------------------------------------------------------

function mergeReturns(
  parsed: ParsedDocstring,
  sig: Signature,
  cfg: BuildConfig,
): { returns: ParsedReturn | undefined; yields: ParsedReturn | undefined } {
  const shouldSkipReturns = cfg.returnsMode === "non-none" && sig.returnType === "None";

  if (sig.isGenerator) {
    // Generator → Yields
    const existingYields = parsed.yields ?? parsed.returns; // tolerate wrong section
    const yields = shouldSkipReturns
      ? undefined
      : existingYields
        ? { type: sig.returnType, description: existingYields.description }
        : { type: sig.returnType, description: cfg.placeholderDescription };
    return { returns: undefined, yields };
  }

  // Regular function → Returns
  const returns = shouldSkipReturns
    ? undefined
    : parsed.returns
      ? { type: sig.returnType, description: parsed.returns.description }
      : { type: sig.returnType, description: cfg.placeholderDescription };

  return { returns, yields: undefined };
}
