/**
 * Unit tests for signature parser.
 * Tests edge cases: decorators, multiline signatures, nested brackets, complex types.
 */
import assert from "node:assert/strict";
import { describe, it, before } from "mocha";
import type { Tree } from "web-tree-sitter";
import { parseCode, initParser } from "../../parser/treeSitter.js";
import {
  extractAllSignatures,
  findDefNodeAtLine,
  extractSignature,
} from "../../parser/signatureParser.js";

/**
 * Helper to parse code in tests, throwing if parsing fails.
 */
function parseCodeOrThrow(code: string): Tree {
  const tree = parseCode(code);
  if (!tree) throw new Error("Failed to parse code");
  return tree;
}

describe("signature parser (unit)", () => {
  before(initParser);

  describe("extractAllSignatures", () => {
    it("collects nested functions/classes in document order", () => {
      const code = `
def outer():
    def inner():
        pass
    
class MyClass:
    def method(self):
        pass
`;
      const tree = parseCodeOrThrow(code.trim());
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs.length, 4);
      assert.equal(sigs[0].name, "outer");
      assert.equal(sigs[1].name, "inner");
      assert.equal(sigs[2].name, "MyClass");
      assert.equal(sigs[3].name, "method");
    });
  });

  describe("parameter extraction", () => {
    it("handles simple params", () => {
      const code = "def f(a, b, c): pass";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].params.length, 3);
      assert.deepEqual(
        sigs[0].params.map((p) => ({ name: p.name, kind: p.kind })),
        [
          { name: "a", kind: "regular" },
          { name: "b", kind: "regular" },
          { name: "c", kind: "regular" },
        ],
      );
    });

    it("handles defaults", () => {
      const code = "def f(a, b=2, c=[1,2,3]): pass";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].params[1].default, "2");
      assert.equal(sigs[0].params[2].default, "[1,2,3]");
    });

    it("handles type annotations", () => {
      const code = "def f(x: int, y: str | None) -> bool: pass";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].params[0].type, "int");
      assert.equal(sigs[0].params[1].type, "str | None");
      assert.equal(sigs[0].returnType, "bool");
    });

    it("handles *args and **kwargs", () => {
      const code = "def f(a, *args, b, **kwargs): pass";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      const kinds = sigs[0].params.map((p) => p.kind);
      assert.deepEqual(kinds, ["regular", "var_positional", "keyword_only", "var_keyword"]);
    });

    it("handles annotated *args and **kwargs", () => {
      const code = "def f(*numbers: float, **entries: str): pass";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].params[0].name, "numbers");
      assert.equal(sigs[0].params[0].type, "float");
      assert.equal(sigs[0].params[0].kind, "var_positional");
      assert.equal(sigs[0].params[1].name, "entries");
      assert.equal(sigs[0].params[1].type, "str");
      assert.equal(sigs[0].params[1].kind, "var_keyword");
    });

    it("handles mixed regular and annotated *args", () => {
      const code = "def f(separator: str, *parts: str) -> str: pass";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].params[0].name, "separator");
      assert.equal(sigs[0].params[0].type, "str");
      assert.equal(sigs[0].params[0].kind, "regular");
      assert.equal(sigs[0].params[1].name, "parts");
      assert.equal(sigs[0].params[1].type, "str");
      assert.equal(sigs[0].params[1].kind, "var_positional");
    });

    it("excludes self and cls", () => {
      const code = `
def method(self, x): pass
@classmethod
def cm(cls, y): pass
`;
      const tree = parseCodeOrThrow(code.trim());
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].params.length, 1);
      assert.equal(sigs[1].params.length, 1);
    });

    it("handles positional-only and keyword-only", () => {
      const code = "def f(a, /, b, *, c): pass";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      const kinds = sigs[0].params.map((p) => p.kind);
      assert.deepEqual(kinds, ["positional_only", "regular", "keyword_only"]);
    });

    it("handles multiline signatures", () => {
      const code = `
def multiline(
    a: int,
    b: str,
    c: dict[str, list[int]],
) -> None:
    pass
`;
      const tree = parseCodeOrThrow(code.trim());
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].params.length, 3);
      assert.equal(sigs[0].params[2].type, "dict[str, list[int]]");
    });

    it("handles nested brackets in defaults", () => {
      const code = 'def f(x={"key": [1,2,3]}, y=(1, 2)): pass';
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].params[0].default, '{"key": [1,2,3]}');
      assert.equal(sigs[0].params[1].default, "(1, 2)");
    });
  });

  describe("decorator handling", () => {
    it("detects single decorator", () => {
      const code = "@decorator\ndef f(): pass";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.deepEqual(sigs[0].decorators, ["decorator"]);
      assert.equal(sigs[0].startLine, 0); // starts at decorator
      assert.equal(sigs[0].defLine, 1); // def is at line 1
    });

    it("detects multiple decorators", () => {
      const code = "@deco1\n@deco2(x=1)\n@deco3\ndef f(): pass";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.deepEqual(sigs[0].decorators, ["deco1", "deco2(x=1)", "deco3"]);
    });
  });

  describe("async and generators", () => {
    it("detects async", () => {
      const code = "async def f(): pass";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].isAsync, true);
    });

    it("detects generator (yield)", () => {
      const code = "def f():\n    yield 1";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].isGenerator, true);
    });

    it("detects generator (yield from)", () => {
      const code = "def f():\n    yield from other()";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].isGenerator, true);
    });

    it("ignores yield in nested function", () => {
      const code = "def f():\n    def g():\n        yield 1";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].isGenerator, false);
    });
  });

  describe("raises detection", () => {
    it("detects raised exceptions", () => {
      const code = "def f():\n    raise ValueError('oops')\n    raise RuntimeError()";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.deepEqual(sigs[0].raises, ["ValueError", "RuntimeError"]);
    });

    it("deduplicates in order of first appearance", () => {
      const code = `
def f():
    if x:
        raise ValueError()
    raise ValueError()
`;
      const tree = parseCodeOrThrow(code.trim());
      const sigs = extractAllSignatures(tree);
      assert.deepEqual(sigs[0].raises, ["ValueError"]);
    });

    it("skips bare raise", () => {
      const code = "def f():\n    raise";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.deepEqual(sigs[0].raises, []);
    });

    it("skips lowercase variable raises", () => {
      const code = "def f():\n    exc = ValueError()\n    raise exc";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.deepEqual(sigs[0].raises, []);
    });

    it("ignores raises in nested defs", () => {
      const code = "def f():\n    def g():\n        raise ValueError()";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.deepEqual(sigs[0].raises, []);
    });
  });

  describe("return value detection", () => {
    it("detects return with a value", () => {
      const code = "def f():\n    return 42";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].hasReturnValue, true);
    });

    it("detects return with an expression", () => {
      const code = "def f(x):\n    return x + 1";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].hasReturnValue, true);
    });

    it("ignores bare return", () => {
      const code = "def f():\n    return";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].hasReturnValue, false);
    });

    it("ignores return None", () => {
      const code = "def f():\n    return None";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].hasReturnValue, false);
    });

    it("false when no return statement", () => {
      const code = "def f():\n    print('hi')";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].hasReturnValue, false);
    });

    it("ignores return in nested function", () => {
      const code = "def f():\n    def g():\n        return 42";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].hasReturnValue, false);
    });

    it("detects return in conditional branch", () => {
      const code = "def f(x):\n    if x:\n        return x\n    return None";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].hasReturnValue, true);
    });

    it("false for class signatures", () => {
      const code = "class C:\n    pass";
      const tree = parseCodeOrThrow(code);
      const sigs = extractAllSignatures(tree);
      assert.equal(sigs[0].hasReturnValue, false);
    });
  });

  describe("findDefNodeAtLine", () => {
    it("finds function at exact line", () => {
      const code = "def f():\n    pass";
      const tree = parseCodeOrThrow(code);
      const found = findDefNodeAtLine(tree, 0);
      assert.ok(found);
      assert.equal(found.def.type, "function_definition");
    });

    it("finds function inside body from inner line", () => {
      const code = "def f():\n    x = 1";
      const tree = parseCodeOrThrow(code);
      const found = findDefNodeAtLine(tree, 1);
      assert.ok(found);
      assert.equal(found.def.type, "function_definition");
    });

    it("associates decorated_definition", () => {
      const code = "@deco\ndef f():\n    pass";
      const tree = parseCodeOrThrow(code);
      const found = findDefNodeAtLine(tree, 1);
      assert.ok(found);
      assert.ok(found.decorated);
      assert.equal(found.decorated.type, "decorated_definition");
    });

    it("returns null for non-def", () => {
      const code = "x = 1";
      const tree = parseCodeOrThrow(code);
      const found = findDefNodeAtLine(tree, 0);
      assert.equal(found, null);
    });
  });
});
