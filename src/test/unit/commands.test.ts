import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  applyInsertions,
  buildGoogleDocstringText,
  generateFileInsertions,
  hasDocstring,
  type DocstringInsertion,
  type ParsedSignature,
} from "../../parser";

// ---------------------------------------------------------------------------
// hasDocstring
// ---------------------------------------------------------------------------

describe("hasDocstring", () => {
  it("returns false when no lines follow", () => {
    assert.equal(hasDocstring(["def foo():"], 0), false);
  });

  it("returns true for double-quote docstring on next line", () => {
    const lines = ["def foo():", '    """docstring"""'];
    assert.equal(hasDocstring(lines, 0), true);
  });

  it("returns true for single-quote docstring on next line", () => {
    const lines = ["def foo():", "    '''docstring'''"];
    assert.equal(hasDocstring(lines, 0), true);
  });

  it("returns false when next non-empty line is not a docstring", () => {
    const lines = ["def foo():", "    return 42"];
    assert.equal(hasDocstring(lines, 0), false);
  });

  it("skips blank lines between def and docstring", () => {
    const lines = ["def foo():", "", '    """docstring"""'];
    assert.equal(hasDocstring(lines, 0), true);
  });

  it("returns false when body is a pass statement", () => {
    const lines = ["def foo():", "    pass"];
    assert.equal(hasDocstring(lines, 0), false);
  });
});

// ---------------------------------------------------------------------------
// buildGoogleDocstringText
// ---------------------------------------------------------------------------

describe("buildGoogleDocstringText", () => {
  const INDENT = "    ";
  const Q = '"""';

  function build(sig: ParsedSignature, opts: { isGenerator?: boolean } = {}): string {
    return buildGoogleDocstringText(sig, INDENT, Q, opts);
  }

  it("no params, no return — one-liner", () => {
    const out = build({ kind: "def", name: "f", params: [], returnAnnotation: null });
    assert.equal(out, `${INDENT}${Q}_summary_.${Q}`);
  });

  it("None return — one-liner (return suppressed)", () => {
    const out = build({ kind: "def", name: "f", params: [], returnAnnotation: "None" });
    assert.equal(out, `${INDENT}${Q}_summary_.${Q}`);
  });

  it("class — one-liner", () => {
    const out = build({ kind: "class", name: "Foo", params: [], returnAnnotation: null });
    assert.equal(out, `${INDENT}${Q}_summary_.${Q}`);
  });

  it("starts with the supplied indent + opening quotes", () => {
    const out = build({ kind: "def", name: "f", params: [], returnAnnotation: null });
    assert.ok(out.startsWith(`${INDENT}${Q}`));
  });

  it("with params — multi-liner with Args section", () => {
    const out = build({
      kind: "def",
      name: "f",
      params: [{ name: "a", annotation: "int", hasDefault: false }],
      returnAnnotation: null,
    });
    assert.ok(out.startsWith(`${INDENT}${Q}_summary_.\n`));
    assert.ok(out.includes(`${INDENT}Args:\n`));
    assert.ok(out.includes("        a (int): _description_\n"));
    assert.ok(out.endsWith(`${INDENT}${Q}`));
  });

  it("with return — multi-liner with Returns section", () => {
    const out = build({
      kind: "def",
      name: "f",
      params: [],
      returnAnnotation: "bool",
    });
    assert.ok(out.includes(`${INDENT}Returns:\n`));
    assert.ok(out.includes("        bool: _description_\n"));
    assert.ok(out.endsWith(`${INDENT}${Q}`));
    // blank line between summary and Returns when there are no params
    assert.ok(out.includes("_summary_.\n\n"));
  });

  it("generator uses Yields section", () => {
    const out = build(
      { kind: "def", name: "f", params: [], returnAnnotation: "int" },
      { isGenerator: true },
    );
    assert.ok(out.includes("Yields:"));
    assert.ok(!out.includes("Returns:"));
  });

  it("*args and **kwargs render with prefix", () => {
    const out = build({
      kind: "def",
      name: "f",
      params: [
        { name: "*args", annotation: null, hasDefault: false },
        { name: "**kwargs", annotation: null, hasDefault: false },
      ],
      returnAnnotation: null,
    });
    assert.ok(out.includes("        *args: _description_\n"));
    assert.ok(out.includes("        **kwargs: _description_\n"));
  });

  it("uses single-quote quoteChar when passed", () => {
    const out = buildGoogleDocstringText(
      { kind: "def", name: "f", params: [], returnAnnotation: null },
      "    ",
      "'''",
    );
    assert.ok(out.startsWith("    '''"));
    assert.ok(out.endsWith("'''"));
  });

  it("includeDefaults appends 'Defaults to X.' for params with a default value", () => {
    const out = buildGoogleDocstringText(
      {
        kind: "def",
        name: "f",
        params: [{ name: "x", annotation: "int", hasDefault: true, defaultValue: "42" }],
        returnAnnotation: null,
      },
      "    ",
      '"""',
      { includeDefaults: true },
    );
    assert.ok(out.includes("x (int): _description_. Defaults to 42.\n"));
  });

  it("includeDefaults=false omits 'Defaults to X.' even when defaultValue is present", () => {
    const out = buildGoogleDocstringText(
      {
        kind: "def",
        name: "f",
        params: [{ name: "x", annotation: "int", hasDefault: true, defaultValue: "42" }],
        returnAnnotation: null,
      },
      "    ",
      '"""',
      { includeDefaults: false },
    );
    assert.ok(!out.includes("Defaults to"));
  });

  it("returnsMode='always' emits Returns for unannotated function", () => {
    const out = buildGoogleDocstringText(
      { kind: "def", name: "f", params: [], returnAnnotation: null },
      "    ",
      '"""',
      { returnsMode: "always" },
    );
    assert.ok(out.includes("Returns:"));
    assert.ok(out.includes("_description_"));
  });

  it("returnsMode='non-none' emits Returns for unannotated, skips -> None", () => {
    const outUnannotated = buildGoogleDocstringText(
      { kind: "def", name: "f", params: [], returnAnnotation: null },
      "    ",
      '"""',
      { returnsMode: "non-none" },
    );
    assert.ok(outUnannotated.includes("Returns:"));

    const outNone = buildGoogleDocstringText(
      { kind: "def", name: "f", params: [], returnAnnotation: "None" },
      "    ",
      '"""',
      { returnsMode: "non-none" },
    );
    assert.ok(!outNone.includes("Returns:"));
  });

  it("includeTypes=false omits type hints from Args entries", () => {
    const out = buildGoogleDocstringText(
      {
        kind: "def",
        name: "f",
        params: [{ name: "x", annotation: "int", hasDefault: false }],
        returnAnnotation: null,
      },
      "    ",
      '"""',
      { includeTypes: false },
    );
    assert.ok(out.includes("        x: _description_\n"));
    assert.ok(!out.includes("(int)"));
  });

  it("custom placeholders appear in output", () => {
    const out = buildGoogleDocstringText(
      {
        kind: "def",
        name: "f",
        params: [{ name: "x", annotation: null, hasDefault: false }],
        returnAnnotation: "str",
      },
      "    ",
      '"""',
      { summaryPlaceholder: "Summary here.", descPlaceholder: "TODO" },
    );
    assert.ok(out.includes("Summary here."));
    assert.ok(out.includes("x: TODO\n"));
    assert.ok(out.includes("str: TODO\n"));
  });
});

// ---------------------------------------------------------------------------
// generateFileInsertions
// ---------------------------------------------------------------------------

describe("generateFileInsertions", () => {
  it("empty file returns no insertions", () => {
    assert.deepEqual(generateFileInsertions([]), []);
  });

  it("single undocumented function returns one insertion", () => {
    const lines = ["def foo():", "    return 42"];
    const ins = generateFileInsertions(lines);
    assert.equal(ins.length, 1);
    assert.equal(ins[0].afterLine, 0);
    assert.ok(ins[0].text.includes("_summary_"));
  });

  it("already-documented function is skipped", () => {
    const lines = ["def foo():", '    """existing"""', "    return 42"];
    assert.deepEqual(generateFileInsertions(lines), []);
  });

  it("multiple undocumented functions get insertions in order", () => {
    const lines = ["def foo():", "    return 1", "", "def bar():", "    return 2"];
    const ins = generateFileInsertions(lines);
    assert.equal(ins.length, 2);
    assert.ok(ins[0].afterLine < ins[1].afterLine);
  });

  it("mix of documented and undocumented functions", () => {
    const lines = [
      "def foo():",
      '    """already here"""',
      "    return 1",
      "",
      "def bar():",
      "    return 2",
    ];
    const ins = generateFileInsertions(lines);
    assert.equal(ins.length, 1);
    assert.equal(ins[0].afterLine, 4);
  });

  it("class declaration gets an insertion", () => {
    const lines = ["class Foo:", "    pass"];
    const ins = generateFileInsertions(lines);
    assert.equal(ins.length, 1);
    assert.equal(ins[0].afterLine, 0);
  });

  it("undocumented method inside class gets an insertion", () => {
    const lines = ["class Foo:", "    def bar(self):", "        return 1"];
    const ins = generateFileInsertions(lines);
    assert.equal(ins.length, 2); // class + method
  });

  it("commented-out def/class lines are not processed", () => {
    const lines = ["# def foo():", "#     return 1"];
    assert.deepEqual(generateFileInsertions(lines), []);
  });

  it("indented commented-out def is not processed", () => {
    const lines = ["class Foo:", "    # def bar(self):", "    #     return 1"];
    const ins = generateFileInsertions(lines);
    assert.equal(ins.length, 1); // only the class, not the commented method
  });
});

// ---------------------------------------------------------------------------
// applyInsertions
// ---------------------------------------------------------------------------

describe("applyInsertions", () => {
  it("empty insertions returns original lines", () => {
    const lines = ["a", "b", "c"];
    assert.deepEqual(applyInsertions(lines, []), lines);
  });

  it("inserts after the specified line", () => {
    const lines = ["def foo():", "    return 1"];
    const ins: DocstringInsertion[] = [{ afterLine: 0, text: '    """doc"""' }];
    const result = applyInsertions(lines, ins);
    assert.deepEqual(result, ["def foo():", '    """doc"""', "    return 1"]);
  });

  it("multiple insertions applied in order without offset errors", () => {
    const lines = ["def foo():", "    return 1", "def bar():", "    return 2"];
    const ins: DocstringInsertion[] = [
      { afterLine: 0, text: '    """foo doc"""' },
      { afterLine: 2, text: '    """bar doc"""' },
    ];
    const result = applyInsertions(lines, ins);
    assert.equal(result.length, 6);
    assert.equal(result[1], '    """foo doc"""');
    assert.equal(result[4], '    """bar doc"""');
  });
});
