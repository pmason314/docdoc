import { expect } from "chai";
import type { FunctionInfo, ClassInfo, Config } from "../../../types.js";
import { DEFAULT_CONFIG } from "../../../types.js";
import { getRenderer } from "../../../docstring/renderer.js";
import type { RenderOptions } from "../../../docstring/renderer.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const BASE_OPTIONS: RenderOptions = {
  indent: "    ",
  quoteChar: '"""',
  raises: [],
};

function cfg(overrides: Partial<Config> = {}): Config {
  return { ...DEFAULT_CONFIG, ...overrides };
}

/** Build a minimal FunctionInfo for testing. */
function fn(overrides: Partial<FunctionInfo> = {}): FunctionInfo {
  return {
    kind: "function",
    name: "foo",
    params: [],
    returnAnnotation: null,
    decorators: [],
    isAsync: false,
    isGenerator: false,
    typeParams: [],
    docstring: null,
    bodyRange: { startLine: 1, startCol: 4, endLine: 2, endCol: 0 },
    signatureRange: { startLine: 0, startCol: 0, endLine: 0, endCol: 40 },
    scopeLevel: "module",
    ...overrides,
  };
}

/** Build a minimal ClassInfo for testing. */
function cls(overrides: Partial<ClassInfo> = {}): ClassInfo {
  return {
    kind: "class",
    name: "Foo",
    decorators: [],
    typeParams: [],
    attributes: [],
    initParams: [],
    docstring: null,
    bodyRange: { startLine: 1, startCol: 4, endLine: 3, endCol: 0 },
    signatureRange: { startLine: 0, startCol: 0, endLine: 0, endCol: 10 },
    ...overrides,
  };
}

// Param builder helpers
const p = {
  reg: (name: string, annotation: string | null = null, def: string | null = null) => ({
    name,
    kind: "regular" as const,
    annotation,
    default: def,
    isOptional: def !== null,
  }),
  posOnly: (name: string, annotation: string | null = null) => ({
    name,
    kind: "positional-only" as const,
    annotation,
    default: null,
    isOptional: false,
  }),
  kwOnly: (name: string, annotation: string | null = null) => ({
    name,
    kind: "keyword-only" as const,
    annotation,
    default: null,
    isOptional: false,
  }),
  args: (annotation: string | null = null) => ({
    name: "args",
    kind: "args" as const,
    annotation,
    default: null,
    isOptional: false,
  }),
  kwargs: (annotation: string | null = null) => ({
    name: "kwargs",
    kind: "kwargs" as const,
    annotation,
    default: null,
    isOptional: false,
  }),
};

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

describe("GoogleRenderer", () => {
  const render = (
    target: FunctionInfo | ClassInfo,
    config: Config = cfg(),
    opts: RenderOptions = BASE_OPTIONS,
  ) => getRenderer("google").render(target, config, opts);

  it("renders summary-only function as one-liner when collapseOneLiners is true", () => {
    const result = render(fn(), cfg({ ruff: { startOnNewLine: false, collapseOneLiners: true } }));
    expect(result).to.equal('"""${1:_summary_}$0"""');
  });

  it("renders summary-only function multi-line when collapseOneLiners is false", () => {
    const result = render(fn(), cfg({ ruff: { startOnNewLine: false, collapseOneLiners: false } }));
    expect(result).to.equal('"""${1:_summary_}$0\n    """');
  });

  it("renders startOnNewLine correctly", () => {
    const result = render(fn(), cfg({ ruff: { startOnNewLine: true, collapseOneLiners: false } }));
    expect(result).to.equal('"""\n    ${1:_summary_}$0\n    """');
  });

  it("renders function with typed params", () => {
    const target = fn({
      params: [p.reg("x", "int"), p.reg("y", "str")],
      returnAnnotation: "bool",
    });
    const result = render(target);
    expect(result).to.include("Args:");
    expect(result).to.include("x (int): ${2:}");
    expect(result).to.include("y (str): ${3:}");
    expect(result).to.include("Returns:");
    expect(result).to.include("bool: ${4:}");
    expect(result).to.include("$0");
  });

  it("omits type when includeTypesFromAnnotations is false", () => {
    const target = fn({ params: [p.reg("x", "int")], returnAnnotation: "bool" });
    const result = render(target, cfg({ includeTypesFromAnnotations: false }));
    expect(result).to.not.include("(int)");
    expect(result).to.include("x: ${2:}");
    expect(result).to.not.include("bool:");
    expect(result).to.include("${3:}"); // return description still present
  });

  it("appends default note when includeDefaults is true", () => {
    const target = fn({ params: [p.reg("x", "int", "5")] });
    const result = render(target, cfg({ includeDefaults: true }));
    expect(result).to.include("Defaults to 5.");
  });

  it("omits default note when includeDefaults is false", () => {
    const target = fn({ params: [p.reg("x", "int", "5")] });
    const result = render(target, cfg({ includeDefaults: false }));
    expect(result).to.not.include("Defaults to");
  });

  it("uses Yields section for generator functions", () => {
    const target = fn({ isGenerator: true, returnAnnotation: "int" });
    const result = render(target, cfg({ detectGenerators: true }));
    expect(result).to.include("Yields:");
    expect(result).to.not.include("Returns:");
  });

  it("suppresses Returns section when return is None and skipNone is true", () => {
    const target = fn({ returnAnnotation: "None" });
    const result = render(target, cfg({ returns: { skipNone: true, requireAnnotation: true } }));
    expect(result).to.not.include("Returns:");
  });

  it("suppresses Returns section when no annotation and requireAnnotation is true", () => {
    const target = fn({ returnAnnotation: null });
    const result = render(target, cfg({ returns: { skipNone: true, requireAnnotation: true } }));
    expect(result).to.not.include("Returns:");
  });

  it("emits Returns section when no annotation and requireAnnotation is false", () => {
    const target = fn({ returnAnnotation: null });
    const result = render(target, cfg({ returns: { skipNone: true, requireAnnotation: false } }));
    expect(result).to.include("Returns:");
  });

  it("renders *args and **kwargs with correct prefix", () => {
    const target = fn({ params: [p.args("int"), p.kwargs("str")] });
    const result = render(target);
    expect(result).to.include("*args (int):");
    expect(result).to.include("**kwargs (str):");
  });

  it("renders Raises section when raises are provided", () => {
    const target = fn({ returnAnnotation: null });
    const result = render(target, cfg(), { ...BASE_OPTIONS, raises: ["ValueError", "TypeError"] });
    expect(result).to.include("Raises:");
    expect(result).to.include("ValueError: ${");
    expect(result).to.include("TypeError: ${");
  });

  it("renders class with attributes", () => {
    const target = cls({
      attributes: [
        { name: "x", annotation: "int", isClassVar: false },
        { name: "y", annotation: "str", isClassVar: true },
      ],
    });
    const result = render(target);
    expect(result).to.include("Attributes:");
    expect(result).to.include("x (int):");
    expect(result).to.include("y (str):");
  });

  it("omits Attributes section when includeClassAttributes is false", () => {
    const target = cls({
      attributes: [{ name: "x", annotation: "int", isClassVar: false }],
    });
    const result = render(target, cfg({ includeClassAttributes: false }));
    expect(result).to.not.include("Attributes:");
  });

  it("renders module-level target with summary only", () => {
    const target = fn({ name: "__module__", scopeLevel: "module" });
    const result = render(
      target,
      cfg({ ruff: { startOnNewLine: false, collapseOneLiners: true } }),
    );
    expect(result).to.include("${1:_summary_}");
    expect(result).to.not.include("Args:");
    expect(result).to.not.include("Returns:");
  });

  it("places $0 after the last tab stop", () => {
    const target = fn({
      params: [p.reg("x", "int")],
      returnAnnotation: "bool",
    });
    const result = render(target);
    // $0 must appear after the last ${N:…}
    const lastStopIdx = result.lastIndexOf("${");
    const cursorIdx = result.lastIndexOf("$0");
    expect(cursorIdx).to.be.greaterThan(lastStopIdx);
  });

  it("includes extended summary stop when enabled", () => {
    const target = fn();
    const result = render(target, cfg({ includeExtendedSummary: true }));
    expect(result).to.include("${2:");
  });
});

// ---------------------------------------------------------------------------
// NumPy
// ---------------------------------------------------------------------------

describe("NumpyRenderer", () => {
  const render = (
    target: FunctionInfo | ClassInfo,
    config: Config = cfg(),
    opts: RenderOptions = BASE_OPTIONS,
  ) => getRenderer("numpy").render(target, config, opts);

  it("renders summary-only as one-liner when collapseOneLiners is true", () => {
    const result = render(fn(), cfg({ ruff: { startOnNewLine: false, collapseOneLiners: true } }));
    expect(result).to.equal('"""${1:_summary_}$0"""');
  });

  it("renders Parameters section with underline", () => {
    const target = fn({ params: [p.reg("x", "int")] });
    const result = render(target);
    expect(result).to.include("Parameters\n    ----------");
    expect(result).to.include("x : int");
  });

  it("marks optional params", () => {
    const target = fn({ params: [p.reg("x", "int", "5")] });
    const result = render(target);
    expect(result).to.include("x : int, optional");
  });

  it("renders *args as optional", () => {
    const target = fn({ params: [p.args("int")] });
    const result = render(target);
    expect(result).to.include("*args : int, optional");
  });

  it("renders Returns section with underline", () => {
    const target = fn({ returnAnnotation: "bool" });
    const result = render(target);
    expect(result).to.include("Returns\n    -------");
    expect(result).to.include("bool");
  });

  it("renders Yields section for generators", () => {
    const target = fn({ isGenerator: true, returnAnnotation: "int" });
    const result = render(target, cfg({ detectGenerators: true }));
    expect(result).to.include("Yields\n    ------");
  });

  it("renders Attributes section", () => {
    const target = cls({
      attributes: [{ name: "x", annotation: "int", isClassVar: false }],
    });
    const result = render(target);
    expect(result).to.include("Attributes\n    ----------");
    expect(result).to.include("x : int");
  });

  it("renders by-default note in description placeholder", () => {
    const target = fn({ params: [p.reg("x", "int", "5")] });
    const result = render(target, cfg({ includeDefaults: true }));
    expect(result).to.include("by default 5");
  });
});

// ---------------------------------------------------------------------------
// Sphinx
// ---------------------------------------------------------------------------

describe("SphinxRenderer", () => {
  const render = (
    target: FunctionInfo | ClassInfo,
    config: Config = cfg(),
    opts: RenderOptions = BASE_OPTIONS,
  ) => getRenderer("sphinx").render(target, config, opts);

  it("renders summary-only as one-liner when collapseOneLiners is true", () => {
    const result = render(fn(), cfg({ ruff: { startOnNewLine: false, collapseOneLiners: true } }));
    expect(result).to.equal('"""${1:_summary_}$0"""');
  });

  it("renders :param and :type directives", () => {
    const target = fn({ params: [p.reg("x", "int"), p.reg("y", "str")] });
    const result = render(target);
    expect(result).to.include(":param x: ${2:}");
    expect(result).to.include(":type x: int");
    expect(result).to.include(":param y: ${3:}");
    expect(result).to.include(":type y: str");
  });

  it("omits :type when includeTypesFromAnnotations is false", () => {
    const target = fn({ params: [p.reg("x", "int")] });
    const result = render(target, cfg({ includeTypesFromAnnotations: false }));
    expect(result).to.not.include(":type");
  });

  it("renders :returns and :rtype", () => {
    const target = fn({ returnAnnotation: "bool" });
    const result = render(target);
    expect(result).to.include(":returns: ${2:}");
    expect(result).to.include(":rtype: bool");
  });

  it("renders :yields for generators", () => {
    const target = fn({ isGenerator: true, returnAnnotation: "int" });
    const result = render(target, cfg({ detectGenerators: true }));
    expect(result).to.include(":yields:");
    expect(result).to.not.include(":returns:");
  });

  it("renders :raises directives", () => {
    const target = fn({ returnAnnotation: null });
    const result = render(target, cfg(), {
      ...BASE_OPTIONS,
      raises: ["ValueError"],
    });
    expect(result).to.include(":raises ValueError: ${");
  });

  it("renders :var and :vartype for class attributes", () => {
    const target = cls({
      attributes: [{ name: "x", annotation: "int", isClassVar: false }],
    });
    const result = render(target);
    expect(result).to.include(":var x: ${");
    expect(result).to.include(":vartype x: int");
  });

  it("renders *args and **kwargs with correct prefix", () => {
    const target = fn({ params: [p.args("int"), p.kwargs("str")] });
    const result = render(target);
    expect(result).to.include(":param *args: ${");
    expect(result).to.include(":type *args: int");
    expect(result).to.include(":param **kwargs: ${");
  });
});
