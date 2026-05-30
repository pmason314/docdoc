import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { parseGoogleDocstring } from "../../docstringParser";
import {
  buildUpdateText,
  mergeDocstring,
  renderGoogleDocstring,
  type ParsedSignature,
} from "../../parser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Asserts result is non-null and returns it. */
function assertResult(
  lines: string[],
  openingLine: number,
): NonNullable<ReturnType<typeof parseGoogleDocstring>> {
  const r = parseGoogleDocstring(lines, openingLine);
  assert.ok(r !== null, "Expected non-null result");
  return r;
}

// ---------------------------------------------------------------------------
// One-liners
// ---------------------------------------------------------------------------

describe("parseGoogleDocstring — one-liner", () => {
  it("parses summary text", () => {
    const r = assertResult(['    """_summary_"""'], 0);
    assert.equal(r.parsed.summary, "_summary_");
  });

  it("startLine === endLine", () => {
    const r = assertResult(['    """_summary_"""'], 0);
    assert.equal(r.startLine, 0);
    assert.equal(r.endLine, 0);
  });

  it("no params, returns, yields, raises", () => {
    const r = assertResult(['    """_summary_"""'], 0);
    assert.deepEqual(r.parsed.params, []);
    assert.equal(r.parsed.returns, null);
    assert.equal(r.parsed.yields, null);
    assert.deepEqual(r.parsed.raises, []);
  });

  it("extracts indent", () => {
    const r = assertResult(['    """_summary_"""'], 0);
    assert.equal(r.indent, "    ");
  });

  it("extracts quoteChar double", () => {
    const r = assertResult(['    """_summary_"""'], 0);
    assert.equal(r.quoteChar, '"""');
  });

  it("single-quote delimiter", () => {
    const r = assertResult(["    '''_summary_'''"], 0);
    assert.equal(r.quoteChar, "'''");
    assert.equal(r.parsed.summary, "_summary_");
    assert.equal(r.endLine, 0);
  });

  it("returns null for non-docstring line", () => {
    assert.equal(parseGoogleDocstring(["    pass"], 0), null);
  });
});

// ---------------------------------------------------------------------------
// Multi-line — structure
// ---------------------------------------------------------------------------

describe("parseGoogleDocstring — multi-line structure", () => {
  it("summary-only: correct startLine/endLine", () => {
    const ls = ['    """_summary_', '    """'];
    const r = assertResult(ls, 0);
    assert.equal(r.startLine, 0);
    assert.equal(r.endLine, 1);
    assert.equal(r.parsed.summary, "_summary_");
  });

  it("respects openingLine offset", () => {
    const ls = ["def foo():", '    """_summary_', "", "    Args:", "        x: value", '    """'];
    const r = assertResult(ls, 1);
    assert.equal(r.startLine, 1);
    assert.equal(r.endLine, 5);
  });

  it("returns null for unterminated docstring", () => {
    assert.equal(parseGoogleDocstring(['    """_summary_'], 0), null);
  });

  it("single-quote multi-line", () => {
    const ls = ["    '''_summary_", "    '''"];
    const r = assertResult(ls, 0);
    assert.equal(r.quoteChar, "'''");
    assert.equal(r.endLine, 1);
  });
});

// ---------------------------------------------------------------------------
// Args section
// ---------------------------------------------------------------------------

describe("parseGoogleDocstring — Args section", () => {
  it("parses annotated params", () => {
    const ls = [
      '    """_summary_',
      "",
      "    Args:",
      "        a (int): first param",
      "        b (str): second param",
      '    """',
    ];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.params.length, 2);
    assert.equal(r.parsed.params[0].name, "a");
    assert.equal(r.parsed.params[0].typehint, "int");
    assert.equal(r.parsed.params[0].description, "first param");
    assert.equal(r.parsed.params[1].name, "b");
    assert.equal(r.parsed.params[1].typehint, "str");
  });

  it("parses unannotated params", () => {
    const ls = ['    """_summary_', "", "    Args:", "        x: the value", '    """'];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.params[0].name, "x");
    assert.equal(r.parsed.params[0].typehint, null);
    assert.equal(r.parsed.params[0].description, "the value");
  });

  it("preserves *args and **kwargs names", () => {
    const ls = [
      '    """_summary_',
      "",
      "    Args:",
      "        *args: _description_",
      "        **kwargs: _description_",
      '    """',
    ];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.params[0].name, "*args");
    assert.equal(r.parsed.params[1].name, "**kwargs");
  });

  it("multi-line param description (continuation lines)", () => {
    const ls = [
      '    """_summary_',
      "",
      "    Args:",
      "        a (int): first line",
      "            continued here",
      '    """',
    ];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.params[0].description, "first line\ncontinued here");
  });

  it("union type hint in parens", () => {
    const ls = [
      '    """_summary_',
      "",
      "    Args:",
      "        x (int | None): _description_",
      '    """',
    ];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.params[0].typehint, "int | None");
  });
});

// ---------------------------------------------------------------------------
// Returns section
// ---------------------------------------------------------------------------

describe("parseGoogleDocstring — Returns section", () => {
  it("parses simple return type", () => {
    const ls = ['    """_summary_', "", "    Returns:", "        bool: the result", '    """'];
    const r = assertResult(ls, 0);
    assert.ok(r.parsed.returns);
    assert.equal(r.parsed.returns.typehint, "bool");
    assert.equal(r.parsed.returns.description, "the result");
  });

  it("parses complex return type annotation", () => {
    const ls = [
      '    """_summary_',
      "",
      "    Returns:",
      "        dict[str, int | None]: _description_",
      '    """',
    ];
    const r = assertResult(ls, 0);
    assert.ok(r.parsed.returns);
    assert.equal(r.parsed.returns.typehint, "dict[str, int | None]");
  });

  it("parses tuple return type", () => {
    const ls = [
      '    """_summary_',
      "",
      "    Returns:",
      "        tuple[int, str]: _description_",
      '    """',
    ];
    const r = assertResult(ls, 0);
    assert.ok(r.parsed.returns);
    assert.equal(r.parsed.returns.typehint, "tuple[int, str]");
  });

  it("absent when no Returns section", () => {
    const ls = ['    """_summary_', '    """'];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.returns, null);
  });
});

// ---------------------------------------------------------------------------
// Yields section
// ---------------------------------------------------------------------------

describe("parseGoogleDocstring — Yields section", () => {
  it("parses Yields instead of Returns", () => {
    const ls = ['    """_summary_', "", "    Yields:", "        int: each number", '    """'];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.returns, null);
    assert.ok(r.parsed.yields);
    assert.equal(r.parsed.yields.typehint, "int");
    assert.equal(r.parsed.yields.description, "each number");
  });
});

// ---------------------------------------------------------------------------
// Raises section
// ---------------------------------------------------------------------------

describe("parseGoogleDocstring — Raises section", () => {
  it("parses single raise", () => {
    const ls = [
      '    """_summary_',
      "",
      "    Raises:",
      "        ValueError: when value is bad",
      '    """',
    ];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.raises.length, 1);
    assert.equal(r.parsed.raises[0].exception, "ValueError");
    assert.equal(r.parsed.raises[0].description, "when value is bad");
  });

  it("parses multiple raises", () => {
    const ls = [
      '    """_summary_',
      "",
      "    Raises:",
      "        ValueError: bad value",
      "        RuntimeError: on failure",
      '    """',
    ];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.raises.length, 2);
    assert.equal(r.parsed.raises[1].exception, "RuntimeError");
  });
});

// ---------------------------------------------------------------------------
// Combined sections
// ---------------------------------------------------------------------------

describe("parseGoogleDocstring — combined sections", () => {
  it("Args + Returns together", () => {
    const ls = [
      '    """_summary_',
      "",
      "    Args:",
      "        a (int): _description_",
      "",
      "    Returns:",
      "        str: _description_",
      '    """',
    ];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.params.length, 1);
    assert.ok(r.parsed.returns);
    assert.equal(r.parsed.returns.typehint, "str");
  });

  it("Args + Returns + Raises", () => {
    const ls = [
      '    """_summary_',
      "",
      "    Args:",
      "        x (int): _description_",
      "",
      "    Returns:",
      "        bool: _description_",
      "",
      "    Raises:",
      "        ValueError: bad input",
      '    """',
    ];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.params.length, 1);
    assert.ok(r.parsed.returns);
    assert.equal(r.parsed.raises.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Unknown sections
// ---------------------------------------------------------------------------

describe("parseGoogleDocstring — unknown sections", () => {
  it("unknown section preserved verbatim", () => {
    const ls = ['    """_summary_', "", "    Note:", "        some note here", '    """'];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.unknownSections.length, 1);
    assert.equal(r.parsed.unknownSections[0].header, "Note");
    assert.ok(r.parsed.unknownSections[0].lines.some((l) => l.includes("some note here")));
  });

  it("known sections are not treated as unknown", () => {
    const ls = [
      '    """_summary_',
      "",
      "    Args:",
      "        x: val",
      "    Returns:",
      "        int: val",
      '    """',
    ];
    const r = assertResult(ls, 0);
    assert.equal(r.parsed.unknownSections.length, 0);
  });
});

// ---------------------------------------------------------------------------
// mergeDocstring (Phase 3b)
// ---------------------------------------------------------------------------

describe("mergeDocstring", () => {
  const INDENT = "    ";
  const Q = '"""';

  /** Build a minimal parsed docstring for testing. */
  function existingDoc(
    overrides: Partial<NonNullable<ReturnType<typeof parseGoogleDocstring>>["parsed"]>,
  ) {
    return {
      summary: "Original summary.",
      extendedSummary: "",
      params: [],
      returns: null,
      yields: null,
      raises: [],
      unknownSections: [],
      ...overrides,
    };
  }

  const sigAB: ParsedSignature = {
    kind: "def",
    name: "f",
    params: [
      { name: "a", annotation: "int", hasDefault: false },
      { name: "b", annotation: null, hasDefault: true },
    ],
    returnAnnotation: null,
  };

  it("preserves existing param descriptions", () => {
    const existing = existingDoc({
      params: [
        { name: "a", typehint: "int", description: "first arg" },
        { name: "b", typehint: null, description: "second arg" },
      ],
    });
    const merged = mergeDocstring(sigAB, existing);
    assert.equal(merged.params[0].description, "first arg");
    assert.equal(merged.params[1].description, "second arg");
  });

  it("new param gets _description_ placeholder", () => {
    const existing = existingDoc({
      params: [{ name: "a", typehint: "int", description: "first arg" }],
    });
    const merged = mergeDocstring(sigAB, existing);
    assert.equal(merged.params.length, 2);
    assert.equal(merged.params[1].name, "b");
    assert.equal(merged.params[1].description, "_description_");
  });

  it("stale params removed", () => {
    const existing = existingDoc({
      params: [
        { name: "a", typehint: "int", description: "first arg" },
        { name: "old", typehint: null, description: "stale" },
      ],
    });
    const sig: ParsedSignature = {
      kind: "def",
      name: "f",
      params: [{ name: "a", annotation: "int", hasDefault: false }],
      returnAnnotation: null,
    };
    const merged = mergeDocstring(sig, existing);
    assert.equal(merged.params.length, 1);
    assert.equal(merged.params[0].name, "a");
  });

  it("return annotation updated, description preserved", () => {
    const existing = existingDoc({
      returns: { typehint: "str", description: "the old result" },
    });
    const sig: ParsedSignature = {
      kind: "def",
      name: "f",
      params: [],
      returnAnnotation: "bool",
    };
    const merged = mergeDocstring(sig, existing);
    assert.ok(merged.returns);
    assert.equal(merged.returns.typehint, "bool");
    assert.equal(merged.returns.description, "the old result");
  });

  it("return suppressed when sig has no return annotation", () => {
    const existing = existingDoc({
      returns: { typehint: "str", description: "old desc" },
    });
    const sig: ParsedSignature = {
      kind: "def",
      name: "f",
      params: [],
      returnAnnotation: null,
    };
    const merged = mergeDocstring(sig, existing);
    assert.equal(merged.returns, null);
  });

  it("return suppressed when sig returns None", () => {
    const existing = existingDoc({ returns: { typehint: "str", description: "old" } });
    const sig: ParsedSignature = {
      kind: "def",
      name: "f",
      params: [],
      returnAnnotation: "None",
    };
    assert.equal(mergeDocstring(sig, existing).returns, null);
  });

  it("isGenerator: emits yields, not returns", () => {
    const existing = existingDoc({
      returns: { typehint: "int", description: "old desc" },
    });
    const sig: ParsedSignature = {
      kind: "def",
      name: "f",
      params: [],
      returnAnnotation: "int",
    };
    const merged = mergeDocstring(sig, existing, { isGenerator: true });
    assert.equal(merged.returns, null);
    assert.ok(merged.yields);
    assert.equal(merged.yields.typehint, "int");
    assert.equal(merged.yields.description, "old desc");
  });

  it("summary and raises preserved unchanged", () => {
    const existing = existingDoc({
      summary: "Keep this.",
      raises: [{ exception: "ValueError", description: "on bad input" }],
    });
    const merged = mergeDocstring(sigAB, existing);
    assert.equal(merged.summary, "Keep this.");
    assert.equal(merged.raises[0].exception, "ValueError");
  });

  it("param order follows sig, not existing", () => {
    const existing = existingDoc({
      params: [
        { name: "b", typehint: null, description: "second" },
        { name: "a", typehint: "int", description: "first" },
      ],
    });
    const merged = mergeDocstring(sigAB, existing);
    assert.equal(merged.params[0].name, "a");
    assert.equal(merged.params[1].name, "b");
  });

  it("typehint updated from sig annotation", () => {
    const existing = existingDoc({
      params: [{ name: "a", typehint: "str", description: "old desc" }],
    });
    // sig says a is int; typehint should be updated
    const merged = mergeDocstring(sigAB, existing);
    assert.equal(merged.params[0].typehint, "int");
    assert.equal(merged.params[0].description, "old desc");
  });
});

// ---------------------------------------------------------------------------
// renderGoogleDocstring (Phase 3b)
// ---------------------------------------------------------------------------

describe("renderGoogleDocstring", () => {
  const INDENT = "    ";
  const Q = '"""';

  function render(doc: Parameters<typeof renderGoogleDocstring>[0]): string {
    return renderGoogleDocstring(doc, INDENT, Q);
  }

  function emptyDoc(summary: string) {
    return {
      summary,
      extendedSummary: "",
      params: [],
      returns: null,
      yields: null,
      raises: [],
      unknownSections: [],
    };
  }

  it("one-liner when no sections", () => {
    assert.equal(render(emptyDoc("_summary_")), `${INDENT}${Q}_summary_${Q}`);
  });

  it("starts with indent + quoteChar + summary", () => {
    const out = render({
      ...emptyDoc("My summary."),
      params: [{ name: "x", typehint: "int", description: "val" }],
    });
    assert.ok(out.startsWith(`${INDENT}${Q}My summary.\n`));
  });

  it("Args section rendered correctly", () => {
    const out = render({
      ...emptyDoc("_summary_"),
      params: [
        { name: "a", typehint: "int", description: "first" },
        { name: "b", typehint: null, description: "second" },
      ],
    });
    assert.ok(out.includes(`${INDENT}Args:\n`));
    assert.ok(out.includes("        a (int): first\n"));
    assert.ok(out.includes("        b: second\n"));
  });

  it("Returns section rendered correctly", () => {
    const out = render({
      ...emptyDoc("_summary_"),
      returns: { typehint: "bool", description: "the result" },
    });
    assert.ok(out.includes(`${INDENT}Returns:\n`));
    assert.ok(out.includes("        bool: the result\n"));
  });

  it("Yields section rendered correctly", () => {
    const out = render({
      ...emptyDoc("_summary_"),
      yields: { typehint: "int", description: "each item" },
    });
    assert.ok(out.includes(`${INDENT}Yields:\n`));
    assert.ok(!out.includes("Returns:"));
  });

  it("Raises section rendered correctly", () => {
    const out = render({
      ...emptyDoc("_summary_"),
      raises: [{ exception: "ValueError", description: "bad input" }],
    });
    assert.ok(out.includes(`${INDENT}Raises:\n`));
    assert.ok(out.includes("        ValueError: bad input\n"));
  });

  it("blank line before Returns when no params", () => {
    const out = render({
      ...emptyDoc("_summary_"),
      returns: { typehint: "bool", description: "_description_" },
    });
    assert.ok(out.includes("_summary_\n\n"));
  });

  it("no blank line between Args and Returns (single \\n separator)", () => {
    const out = render({
      ...emptyDoc("s"),
      params: [{ name: "a", typehint: null, description: "d" }],
      returns: { typehint: "int", description: "r" },
    });
    // The Args section ends with '\n', then '\n' starts Returns → '\n\n    Returns:'
    assert.ok(out.includes("\n\n    Returns:"));
  });

  it("round-trip: parse → render produces identical text", () => {
    const original = [
      '    """_summary_',
      "",
      "    Args:",
      "        a (int): first param",
      "        b: second param",
      "",
      "    Returns:",
      "        str: the result",
      '    """',
    ];
    const parsed = parseGoogleDocstring(original, 0);
    assert.ok(parsed);
    const rendered = renderGoogleDocstring(parsed.parsed, parsed.indent, parsed.quoteChar);
    assert.equal(rendered, original.join("\n"));
  });

  it("round-trip: one-liner", () => {
    const ls = ['    """_summary_"""'];
    const parsed = parseGoogleDocstring(ls, 0);
    assert.ok(parsed);
    const rendered = renderGoogleDocstring(parsed.parsed, parsed.indent, parsed.quoteChar);
    assert.equal(rendered, ls[0]);
  });
});

// ---------------------------------------------------------------------------
// buildUpdateText (Phase 3b)
// ---------------------------------------------------------------------------

describe("buildUpdateText", () => {
  it("returns null when no docstring present", () => {
    const lines = ["def foo():", "    return 1"];
    assert.equal(buildUpdateText(lines, 0), null);
  });

  it("returns null when line is not a def", () => {
    const lines = ["x = 1"];
    assert.equal(buildUpdateText(lines, 0), null);
  });

  it("basic round-trip: unchanged sig → identical docstring", () => {
    const lines = [
      "def foo(a: int) -> str:",
      '    """_summary_',
      "",
      "    Args:",
      "        a (int): _description_",
      "",
      "    Returns:",
      "        str: _description_",
      '    """',
      "    return str(a)",
    ];
    const result = buildUpdateText(lines, 0);
    assert.ok(result);
    assert.equal(result.startLine, 1);
    assert.equal(result.endLine, 8);
    // Rendered text should contain the same sections
    assert.ok(result.text.includes("Args:"));
    assert.ok(result.text.includes("a (int): _description_"));
    assert.ok(result.text.includes("Returns:"));
  });

  it("new param added to existing docstring", () => {
    const lines = [
      "def foo(a: int, b: str) -> None:",
      '    """_summary_',
      "",
      "    Args:",
      "        a (int): the number",
      '    """',
      "    pass",
    ];
    const result = buildUpdateText(lines, 0);
    assert.ok(result);
    assert.ok(result.text.includes("b (str): _description_"));
    assert.ok(result.text.includes("a (int): the number")); // preserved
  });

  it("stale param removed", () => {
    const lines = [
      "def foo(a: int) -> None:",
      '    """_summary_',
      "",
      "    Args:",
      "        a (int): the number",
      "        old: stale param",
      '    """',
      "    pass",
    ];
    const result = buildUpdateText(lines, 0);
    assert.ok(result);
    assert.ok(!result.text.includes("old:"));
  });

  it("one-liner docstring updated to multi-line when param added", () => {
    const lines = ["def foo(a: int) -> None:", '    """_summary_"""', "    pass"];
    const result = buildUpdateText(lines, 0);
    assert.ok(result);
    assert.equal(result.startLine, 1);
    assert.equal(result.endLine, 1);
    assert.ok(result.text.includes("Args:"));
    assert.ok(result.text.includes("a (int):"));
  });
});
