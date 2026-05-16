import { expect } from "chai";
import type { Parser } from "web-tree-sitter";
import { getParser } from "../../../parser/treeSitter.js";
import { extractFunctionInfo, extractClassInfo } from "../../../parser/signatureExtractor.js";
import { resolveTarget } from "../../../parser/scopeResolver.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let parser: Parser;

before(async () => {
  ({ parser } = await getParser());
});

function parseFn(src: string) {
  const tree = parser.parse(src);
  // Handle decorated_definition wrapping
  const root = tree.rootNode;
  let candidate = root.namedChildren[0];
  let decorators: string[] = [];
  if (candidate.type === "decorated_definition") {
    decorators = candidate.namedChildren.filter((c) => c.type === "decorator").map((c) => c.text);
    candidate = candidate.namedChildren.find((c) => c.type === "function_definition")!;
  }
  return extractFunctionInfo(candidate, decorators);
}

function parseCls(src: string, mergeInitParams = false) {
  const tree = parser.parse(src);
  const root = tree.rootNode;
  let candidate = root.namedChildren[0];
  let decorators: string[] = [];
  if (candidate.type === "decorated_definition") {
    decorators = candidate.namedChildren.filter((c) => c.type === "decorator").map((c) => c.text);
    candidate = candidate.namedChildren.find((c) => c.type === "class_definition")!;
  }
  return extractClassInfo(candidate, decorators, mergeInitParams);
}

// ---------------------------------------------------------------------------
// extractFunctionInfo — parameters
// ---------------------------------------------------------------------------

describe("extractFunctionInfo", () => {
  describe("basic parameters", () => {
    it("extracts a simple function with no params", () => {
      const info = parseFn("def foo() -> None:\n    pass\n");
      expect(info.name).to.equal("foo");
      expect(info.params).to.be.empty;
      expect(info.returnAnnotation).to.equal("None");
    });

    it("extracts typed params", () => {
      const info = parseFn("def foo(x: int, y: str) -> bool:\n    pass\n");
      expect(info.params).to.have.length(2);
      expect(info.params[0]).to.deep.include({
        name: "x",
        kind: "regular",
        annotation: "int",
        default: null,
        isOptional: false,
      });
      expect(info.params[1]).to.deep.include({
        name: "y",
        kind: "regular",
        annotation: "str",
      });
    });

    it("extracts default values", () => {
      const info = parseFn("def foo(x: int = 5, y: str = 'hi') -> None:\n    pass\n");
      expect(info.params[0]).to.deep.include({
        default: "5",
        isOptional: true,
      });
      expect(info.params[1]).to.deep.include({
        default: "'hi'",
        isOptional: true,
      });
    });

    it("extracts untyped param with default", () => {
      const info = parseFn("def foo(x=5):\n    pass\n");
      expect(info.params[0]).to.deep.include({
        name: "x",
        annotation: null,
        default: "5",
        isOptional: true,
      });
    });

    it("suppresses self and cls", () => {
      const info = parseFn("def foo(self, x: int):\n    pass\n");
      expect(info.params).to.have.length(1);
      expect(info.params[0].name).to.equal("x");
    });

    it("extracts *args and **kwargs without annotations", () => {
      const info = parseFn("def foo(*args, **kwargs):\n    pass\n");
      expect(info.params[0]).to.deep.include({
        name: "args",
        kind: "args",
        annotation: null,
      });
      expect(info.params[1]).to.deep.include({
        name: "kwargs",
        kind: "kwargs",
        annotation: null,
      });
    });

    it("extracts *args and **kwargs with annotations", () => {
      const info = parseFn("def foo(*args: int, **kwargs: str):\n    pass\n");
      expect(info.params[0]).to.deep.include({
        name: "args",
        kind: "args",
        annotation: "int",
      });
      expect(info.params[1]).to.deep.include({
        name: "kwargs",
        kind: "kwargs",
        annotation: "str",
      });
    });
  });

  describe("positional-only and keyword-only", () => {
    it("classifies positional-only params correctly", () => {
      const info = parseFn("def foo(a, b, /, c):\n    pass\n");
      expect(info.params[0]).to.deep.include({ name: "a", kind: "positional-only" });
      expect(info.params[1]).to.deep.include({ name: "b", kind: "positional-only" });
      expect(info.params[2]).to.deep.include({ name: "c", kind: "regular" });
    });

    it("classifies keyword-only params correctly", () => {
      const info = parseFn("def foo(a, *, b, c: int = 5):\n    pass\n");
      expect(info.params[0]).to.deep.include({ name: "a", kind: "regular" });
      expect(info.params[1]).to.deep.include({ name: "b", kind: "keyword-only" });
      expect(info.params[2]).to.deep.include({ name: "c", kind: "keyword-only" });
    });

    it("handles combined positional-only, regular, and keyword-only", () => {
      const info = parseFn("def foo(a, b, /, c, *, d):\n    pass\n");
      expect(info.params[0].kind).to.equal("positional-only");
      expect(info.params[1].kind).to.equal("positional-only");
      expect(info.params[2].kind).to.equal("regular");
      expect(info.params[3].kind).to.equal("keyword-only");
    });
  });

  describe("async and generator", () => {
    it("detects async functions", () => {
      const info = parseFn("async def foo():\n    pass\n");
      expect(info.isAsync).to.be.true;
    });

    it("non-async functions are not async", () => {
      const info = parseFn("def foo():\n    pass\n");
      expect(info.isAsync).to.be.false;
    });

    it("detects generators", () => {
      const info = parseFn("def foo():\n    yield 1\n");
      expect(info.isGenerator).to.be.true;
    });

    it("does not flag nested yield as generator", () => {
      const info = parseFn("def foo():\n    def inner():\n        yield 1\n    return 42\n");
      expect(info.isGenerator).to.be.false;
    });

    it("detects yield in async generators", () => {
      const info = parseFn("async def foo():\n    yield 1\n");
      expect(info.isGenerator).to.be.true;
    });
  });

  describe("PEP 695 type parameters", () => {
    it("extracts plain TypeVar", () => {
      const info = parseFn("def foo[T](x: T) -> T:\n    pass\n");
      expect(info.typeParams).to.have.length(1);
      expect(info.typeParams[0]).to.deep.include({
        name: "T",
        bound: null,
        variance: "TypeVar",
      });
    });

    it("extracts TypeVarTuple", () => {
      const info = parseFn("def foo[*Ts]():\n    pass\n");
      expect(info.typeParams[0]).to.deep.include({
        name: "Ts",
        variance: "TypeVarTuple",
      });
    });

    it("extracts ParamSpec", () => {
      const info = parseFn("def foo[**P]():\n    pass\n");
      expect(info.typeParams[0]).to.deep.include({
        name: "P",
        variance: "ParamSpec",
      });
    });

    it("extracts constrained TypeVar with bound", () => {
      const info = parseFn("def foo[S: str]():\n    pass\n");
      expect(info.typeParams[0]).to.deep.include({
        name: "S",
        bound: "str",
        variance: "TypeVar",
      });
    });

    it("extracts multiple mixed type params", () => {
      const info = parseFn("def foo[T, *Ts, **P, S: str]():\n    pass\n");
      expect(info.typeParams).to.have.length(4);
    });
  });

  describe("decorators", () => {
    it("captures decorator text", () => {
      const info = parseFn("@staticmethod\ndef foo(x: int):\n    pass\n");
      expect(info.decorators).to.deep.equal(["@staticmethod"]);
    });

    it("captures multiple decorators", () => {
      const info = parseFn("@classmethod\n@some_decorator\ndef foo(cls):\n    pass\n");
      expect(info.decorators).to.include("@classmethod");
      expect(info.decorators).to.include("@some_decorator");
    });
  });

  describe("existing docstring", () => {
    it("captures an existing docstring", () => {
      const info = parseFn('def foo():\n    """Existing docstring."""\n    pass\n');
      expect(info.docstring).to.equal('"""Existing docstring."""');
    });

    it("returns null when no docstring exists", () => {
      const info = parseFn("def foo():\n    pass\n");
      expect(info.docstring).to.be.null;
    });
  });

  describe("scope level", () => {
    it("returns module for top-level function", () => {
      const info = parseFn("def foo():\n    pass\n");
      expect(info.scopeLevel).to.equal("module");
    });

    it("returns class for method", () => {
      const src = "class C:\n    def foo(self):\n        pass\n";
      const tree = parser.parse(src);
      const cls = tree.rootNode.namedChildren[0];
      const body = cls.childForFieldName("body")!;
      const fn = body.namedChildren.find((c) => c.type === "function_definition")!;
      const info = extractFunctionInfo(fn, []);
      expect(info.scopeLevel).to.equal("class");
    });

    it("returns function for nested function", () => {
      const src = "def outer():\n    def inner():\n        pass\n";
      const tree = parser.parse(src);
      const outer = tree.rootNode.namedChildren[0];
      const body = outer.childForFieldName("body")!;
      const inner = body.namedChildren.find((c) => c.type === "function_definition")!;
      const info = extractFunctionInfo(inner, []);
      expect(info.scopeLevel).to.equal("function");
    });
  });

  describe("edge cases", () => {
    it("handles multi-line signatures", () => {
      const info = parseFn("def foo(\n    x: int,\n    y: str = 'hi',\n) -> bool:\n    pass\n");
      expect(info.params).to.have.length(2);
      expect(info.returnAnnotation).to.equal("bool");
    });

    it("handles complex generic annotations", () => {
      const info = parseFn("def foo(x: dict[str, list[int]]) -> None:\n    pass\n");
      expect(info.params[0].annotation).to.equal("dict[str, list[int]]");
    });
  });
});

// ---------------------------------------------------------------------------
// extractClassInfo
// ---------------------------------------------------------------------------

describe("extractClassInfo", () => {
  it("extracts class name", () => {
    const info = parseCls("class Foo:\n    pass\n");
    expect(info.name).to.equal("Foo");
  });

  it("extracts class attributes", () => {
    const info = parseCls("class Foo:\n    x: int\n    y: str\n");
    expect(info.attributes).to.have.length(2);
    expect(info.attributes[0]).to.deep.include({
      name: "x",
      annotation: "int",
      isClassVar: false,
    });
  });

  it("detects ClassVar attributes", () => {
    const info = parseCls("class Foo:\n    x: ClassVar[int] = 0\n");
    expect(info.attributes[0]).to.deep.include({
      name: "x",
      isClassVar: true,
    });
  });

  it("ignores non-annotated assignments", () => {
    const info = parseCls("class Foo:\n    x: int\n    y = 5\n");
    expect(info.attributes).to.have.length(1);
    expect(info.attributes[0].name).to.equal("x");
  });

  it("extracts existing docstring", () => {
    const info = parseCls('class Foo:\n    """Class docstring."""\n    pass\n');
    expect(info.docstring).to.equal('"""Class docstring."""');
  });

  it("merges __init__ params when requested", () => {
    const src = "class Foo:\n    def __init__(self, x: int, y: str):\n        pass\n";
    const info = parseCls(src, true);
    expect(info.initParams).to.have.length(2);
    expect(info.initParams[0].name).to.equal("x");
  });

  it("leaves initParams empty when mergeInitParams is false", () => {
    const src = "class Foo:\n    def __init__(self, x: int):\n        pass\n";
    const info = parseCls(src, false);
    expect(info.initParams).to.be.empty;
  });

  it("extracts PEP 695 type params on class", () => {
    const info = parseCls("class Foo[T, S: str]:\n    pass\n");
    expect(info.typeParams).to.have.length(2);
  });
});

// ---------------------------------------------------------------------------
// resolveTarget
// ---------------------------------------------------------------------------

describe("resolveTarget", () => {
  it("resolves function at cursor inside def line", () => {
    const src = "def foo(x: int) -> bool:\n    pass\n";
    const result = resolveTarget(src, 0, 5, parser);
    expect(result?.kind).to.equal("function");
    expect((result as any).name).to.equal("foo");
  });

  it("resolves class at cursor inside class body", () => {
    const src = "class Foo:\n    x: int\n";
    const result = resolveTarget(src, 1, 4, parser);
    expect(result?.kind).to.equal("class");
  });

  it("resolves outer function when cursor is on nested def", () => {
    const src = "def outer():\n    def inner():\n        pass\n    pass\n";
    // Cursor on "def inner" line → resolves inner
    const inner = resolveTarget(src, 1, 4, parser);
    expect((inner as any).name).to.equal("inner");
    // Cursor on "pass" after inner → resolves outer
    const outer = resolveTarget(src, 3, 4, parser);
    expect((outer as any).name).to.equal("outer");
  });

  it("returns module-level target for empty source or top of file", () => {
    const src = "x = 1\n";
    const result = resolveTarget(src, 0, 0, parser);
    expect(result?.kind).to.equal("function");
    expect((result as any).name).to.equal("__module__");
    expect((result as any).scopeLevel).to.equal("module");
  });

  it("skips @typing.overload functions", () => {
    const src = "@typing.overload\ndef foo(x: int) -> int: ...\n\ndef foo(x: str) -> str: ...\n";
    // Cursor on overload function → should skip to module level
    const result = resolveTarget(src, 1, 0, parser);
    // After skipping the overload, no other enclosing scope → module level
    expect((result as any).name).to.equal("__module__");
  });

  it("skips bare @overload functions", () => {
    const src = "@overload\ndef foo(x: int) -> int: ...\n\ndef foo(x: str) -> str:\n    pass\n";
    const result = resolveTarget(src, 1, 0, parser);
    expect((result as any).name).to.equal("__module__");
  });

  it("resolves module docstring target", () => {
    const src = '"""Module docstring."""\nx = 1\n';
    const result = resolveTarget(src, 0, 0, parser);
    expect((result as any).name).to.equal("__module__");
    expect((result as any).docstring).to.equal('"""Module docstring."""');
  });

  it("returns null for empty source", () => {
    const result = resolveTarget("", 0, 0, parser);
    expect(result).to.be.null;
  });
});
