import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  splitParams,
  parseParam,
  findSignatureFromLines,
  isModuleLevelLines,
  buildGoogleDocstring,
  type Param,
  type ParsedSignature,
} from "../../parser";

// ---------------------------------------------------------------------------
// splitParams
// ---------------------------------------------------------------------------

describe("splitParams", () => {
  it("empty string returns empty array", () => {
    assert.deepEqual(splitParams(""), []);
  });

  it("single plain param", () => {
    assert.deepEqual(splitParams("a"), ["a"]);
  });

  it("multiple plain params", () => {
    assert.deepEqual(splitParams("a, b, c"), ["a", "b", "c"]);
  });

  it("does not split on comma inside brackets", () => {
    assert.deepEqual(splitParams("a: Dict[str, int], b: int"), ["a: Dict[str, int]", "b: int"]);
  });

  it("handles nested generics", () => {
    assert.deepEqual(splitParams("a: tuple[int, str], b: list[tuple[str, int]]"), [
      "a: tuple[int, str]",
      "b: list[tuple[str, int]]",
    ]);
  });

  it("preserves *args and **kwargs tokens", () => {
    assert.deepEqual(splitParams("*args, **kwargs"), ["*args", "**kwargs"]);
  });

  it("preserves bare * separator", () => {
    assert.deepEqual(splitParams("a, *, b, c=3"), ["a", "*", "b", "c=3"]);
  });
});

// ---------------------------------------------------------------------------
// parseParam
// ---------------------------------------------------------------------------

describe("parseParam", () => {
  it("bare * returns null", () => {
    assert.equal(parseParam("*"), null);
  });

  it("plain param", () => {
    assert.deepEqual(parseParam("a"), {
      name: "a",
      annotation: null,
      hasDefault: false,
    });
  });

  it("param with annotation", () => {
    assert.deepEqual(parseParam("x: int"), {
      name: "x",
      annotation: "int",
      hasDefault: false,
    });
  });

  it("param with annotation and default", () => {
    assert.deepEqual(parseParam("b: str = 'x'"), {
      name: "b",
      annotation: "str",
      hasDefault: true,
    });
  });

  it("param with default only", () => {
    assert.deepEqual(parseParam("b=2"), {
      name: "b",
      annotation: null,
      hasDefault: true,
    });
  });

  it("*args", () => {
    assert.deepEqual(parseParam("*args"), {
      name: "args",
      annotation: null,
      hasDefault: false,
    });
  });

  it("**kwargs", () => {
    assert.deepEqual(parseParam("**kwargs"), {
      name: "kwargs",
      annotation: null,
      hasDefault: false,
    });
  });

  it("param with complex annotation", () => {
    assert.deepEqual(parseParam("x: int | None"), {
      name: "x",
      annotation: "int | None",
      hasDefault: false,
    });
  });
});

// ---------------------------------------------------------------------------
// findSignatureFromLines  (scenarios derived from test.py)
// ---------------------------------------------------------------------------

describe("findSignatureFromLines", () => {
  // Helper: returns lines up to and including a def/class line, startLine = last index
  function sig(lines: string[]): ParsedSignature | null {
    return findSignatureFromLines(lines, lines.length - 1);
  }

  it("func_no_params — no params, no return", () => {
    const result = sig(["def func_no_params():"]);
    assert.deepEqual(result, {
      kind: "def",
      name: "func_no_params",
      params: [],
      returnAnnotation: null,
    });
  });

  it("func_with_params — default + variadic params + return annotation", () => {
    const result = sig(["def func_with_params(a, b=2, *args, **kwargs) -> int:"]);
    assert.ok(result);
    assert.equal(result.kind, "def");
    assert.equal(result.name, "func_with_params");
    assert.equal(result.returnAnnotation, "int");
    const names = result.params.map((p) => p.name);
    assert.deepEqual(names, ["a", "b", "args", "kwargs"]);
    assert.equal(result.params[1].hasDefault, true);
  });

  it("func_with_annotations — annotated params", () => {
    const result = sig(["def func_with_annotations(x: int, y: str) -> str:"]);
    assert.ok(result);
    assert.deepEqual(result.params, [
      { name: "x", annotation: "int", hasDefault: false },
      { name: "y", annotation: "str", hasDefault: false },
    ]);
    assert.equal(result.returnAnnotation, "str");
  });

  it("async def — treated same as def", () => {
    const result = sig(["async def async_func(x):"]);
    assert.ok(result);
    assert.equal(result.kind, "def");
    assert.equal(result.name, "async_func");
    assert.deepEqual(result.params, [{ name: "x", annotation: null, hasDefault: false }]);
  });

  it("kw_only — bare * separator is dropped", () => {
    const result = sig(["def kw_only(a, *, b, c=3):"]);
    assert.ok(result);
    const names = result.params.map((p) => p.name);
    assert.deepEqual(names, ["a", "b", "c"]);
    assert.equal(result.params[2].hasDefault, true);
  });

  it("complex_typing — union return annotation preserved", () => {
    const result = sig(["def complex_typing(x: int | None) -> str | None:"]);
    assert.ok(result);
    assert.equal(result.returnAnnotation, "str | None");
    assert.deepEqual(result.params, [{ name: "x", annotation: "int | None", hasDefault: false }]);
  });

  it("returns_tuple — generic return annotation preserved", () => {
    const result = sig(["def returns_tuple() -> tuple[int, str]:"]);
    assert.ok(result);
    assert.equal(result.returnAnnotation, "tuple[int, str]");
    assert.deepEqual(result.params, []);
  });

  it("class declaration returns class kind", () => {
    const result = sig(["class SimpleClass:"]);
    assert.deepEqual(result, {
      kind: "class",
      name: "SimpleClass",
      params: [],
      returnAnnotation: null,
    });
  });

  it("class with base class", () => {
    const result = sig(["class MyError(ValueError):"]);
    assert.ok(result);
    assert.equal(result.kind, "class");
    assert.equal(result.name, "MyError");
  });

  it("method — self is stripped", () => {
    const result = sig(["    def method(self, z):"]);
    assert.ok(result);
    const names = result.params.map((p) => p.name);
    assert.deepEqual(names, ["z"]);
  });

  it("__init__ — self stripped, defaults preserved", () => {
    const result = sig(["    def __init__(self, x, y=1):"]);
    assert.ok(result);
    assert.deepEqual(result.params, [
      { name: "x", annotation: null, hasDefault: false },
      { name: "y", annotation: null, hasDefault: true },
    ]);
  });

  it("@classmethod — cls is stripped", () => {
    const result = sig(["    @classmethod", "    def cm(cls, v):"]);
    assert.ok(result);
    const names = result.params.map((p) => p.name);
    assert.deepEqual(names, ["v"]);
  });

  it("@staticmethod — no stripping needed", () => {
    const result = sig(["    @staticmethod", "    def sm(v):"]);
    assert.ok(result);
    assert.deepEqual(result.params, [{ name: "v", annotation: null, hasDefault: false }]);
  });

  it("@property getter — self stripped → empty params", () => {
    const result = sig(["    @property", "    def value(self):"]);
    assert.ok(result);
    assert.deepEqual(result.params, []);
  });

  it("@value.setter — self stripped, v remains", () => {
    const result = sig(["    @value.setter", "    def value(self, v):"]);
    assert.ok(result);
    const names = result.params.map((p) => p.name);
    assert.deepEqual(names, ["v"]);
  });

  it("blank lines between cursor and def are skipped", () => {
    const result = findSignatureFromLines(
      ["def foo(a: int) -> bool:", "    pass", ""],
      2, // startLine is blank line
    );
    assert.equal(result, null); // blank line stops scan (not a decorator/blank above the cursor *below* the def)
  });

  it("blank line immediately before cursor, def above it", () => {
    const result = findSignatureFromLines(
      ["def foo(a: int) -> bool:", ""],
      1, // blank line
    );
    assert.ok(result);
    assert.equal(result.name, "foo");
  });

  it("returns null when no def/class found", () => {
    const result = findSignatureFromLines(["x = 1", "y = 2"], 1);
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// isModuleLevelLines
// ---------------------------------------------------------------------------

describe("isModuleLevelLines", () => {
  it("empty document is module level", () => {
    assert.equal(isModuleLevelLines([], -1), true);
  });

  it("only blank lines is module level", () => {
    assert.equal(isModuleLevelLines(["", "  ", ""], 2), true);
  });

  it("only comments is module level", () => {
    assert.equal(isModuleLevelLines(["# comment", "# another"], 1), true);
  });

  it("mix of blanks and comments is module level", () => {
    assert.equal(isModuleLevelLines(["# header", "", "# more"], 2), true);
  });

  it("code present means not module level", () => {
    assert.equal(isModuleLevelLines(["import os", ""], 1), false);
  });

  it("def line means not module level", () => {
    assert.equal(isModuleLevelLines(["def foo():", "    pass", ""], 2), false);
  });
});

// ---------------------------------------------------------------------------
// buildGoogleDocstring
// ---------------------------------------------------------------------------

describe("buildGoogleDocstring", () => {
  const INDENT = "    ";
  const Q = '"""';

  function build(sig: ParsedSignature): string {
    return buildGoogleDocstring(sig, INDENT, Q);
  }

  it("no params, no return — summary + closing quotes only", () => {
    const out = build({
      kind: "def",
      name: "f",
      params: [],
      returnAnnotation: null,
    });
    assert.ok(out.includes("_summary_"));
    assert.ok(out.includes(`${INDENT}${Q}`));
    assert.ok(!out.includes("Args:"));
    assert.ok(!out.includes("Returns:"));
  });

  it("None return annotation is suppressed", () => {
    const out = build({
      kind: "def",
      name: "f",
      params: [],
      returnAnnotation: "None",
    });
    assert.ok(!out.includes("Returns:"));
  });

  it("with params but no return — Args section, no Returns", () => {
    const out = build({
      kind: "def",
      name: "f",
      params: [{ name: "a", annotation: "int", hasDefault: false }],
      returnAnnotation: null,
    });
    assert.ok(out.includes("Args:"));
    assert.ok(out.includes("a (int):"));
    assert.ok(!out.includes("Returns:"));
  });

  it("with return but no params — Returns section, no Args", () => {
    const out = build({
      kind: "def",
      name: "f",
      params: [],
      returnAnnotation: "bool",
    });
    assert.ok(!out.includes("Args:"));
    assert.ok(out.includes("Returns:"));
    assert.ok(out.includes("bool:"));
  });

  it("with params and return — full Google docstring", () => {
    const out = build({
      kind: "def",
      name: "f",
      params: [
        { name: "x", annotation: "int", hasDefault: false },
        { name: "y", annotation: "str", hasDefault: true },
      ],
      returnAnnotation: "bool",
    });
    assert.ok(out.includes("Args:"));
    assert.ok(out.includes("x (int):"));
    assert.ok(out.includes("y (str):"));
    assert.ok(out.includes("Returns:"));
    assert.ok(out.includes("bool:"));
    // Tab stops should be numbered
    assert.ok(out.includes("${1:_summary_}"));
    assert.ok(out.includes("${2:_description_}"));
    assert.ok(out.includes("${3:_description_}"));
    assert.ok(out.includes("${4:_description_}"));
  });

  it("unannotated param has no parenthesised type", () => {
    const out = build({
      kind: "def",
      name: "f",
      params: [{ name: "a", annotation: null, hasDefault: false }],
      returnAnnotation: null,
    });
    assert.ok(out.includes("a:"));
    assert.ok(!out.includes("a ():"));
  });

  it("class — only summary + closing quotes (no Args/Returns)", () => {
    const out = build({
      kind: "class",
      name: "Foo",
      params: [],
      returnAnnotation: null,
    });
    assert.ok(out.includes("_summary_"));
    assert.ok(!out.includes("Args:"));
    assert.ok(!out.includes("Returns:"));
  });

  it("section headers use the caller-supplied indent", () => {
    const out = buildGoogleDocstring(
      {
        kind: "def",
        name: "f",
        params: [{ name: "a", annotation: null, hasDefault: false }],
        returnAnnotation: "int",
      },
      "    ",
      '"""',
    );
    // Args: and Returns: should be at the same indent level as the opening """
    assert.ok(out.includes("    Args:"));
    assert.ok(out.includes("    Returns:"));
    // Param lines should be indented one level deeper
    assert.ok(out.includes("        a:"));
  });

  it("complex return annotation preserved verbatim", () => {
    const out = build({
      kind: "def",
      name: "f",
      params: [],
      returnAnnotation: "str | None",
    });
    assert.ok(out.includes("str | None:"));
  });

  it("tuple return annotation preserved verbatim", () => {
    const out = build({
      kind: "def",
      name: "f",
      params: [],
      returnAnnotation: "tuple[int, str]",
    });
    assert.ok(out.includes("tuple[int, str]:"));
  });
});
