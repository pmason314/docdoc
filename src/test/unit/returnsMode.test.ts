/**
 * Tests for returnsMode: "auto" across all three builders and the merger.
 *
 * Verifies that the Returns section is included only when the function body
 * contains a `return <value>` statement (not bare `return` or `return None`).
 */
import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { buildGoogleText } from "../../builder/google.js";
import { buildNumpyText } from "../../builder/numpy.js";
import { buildSphinxText } from "../../builder/sphinx.js";
import { mergeDocstring } from "../../docstringParser/merger.js";
import type { BuildConfig, Signature } from "../../types.js";
import { DEFAULT_CONFIG } from "../../types.js";
import type { ParsedDocstring } from "../../docstringParser/types.js";

const AUTO_CFG: BuildConfig = { ...DEFAULT_CONFIG, returnsMode: "auto" };
const ALWAYS_CFG: BuildConfig = { ...DEFAULT_CONFIG, returnsMode: "always" };

function makeSig(overrides: Partial<Signature> = {}): Signature {
  return {
    kind: "function",
    name: "f",
    params: [],
    returnType: undefined,
    hasReturnValue: false,
    isAsync: false,
    isGenerator: false,
    raises: [],
    decorators: [],
    startLine: 0,
    defLine: 0,
    bodyStartLine: 1,
    bodyEndLine: 1,
    ...overrides,
  };
}

describe("returnsMode: auto", () => {
  describe("Google builder", () => {
    it("includes Returns when body returns a value", () => {
      const sig = makeSig({ returnType: "int", hasReturnValue: true });
      const result = buildGoogleText(sig, "    ", AUTO_CFG);
      assert.ok(result.includes("Returns:"), "should contain Returns section");
      assert.ok(result.includes("int:"), "should contain return type");
    });

    it("omits Returns when body has no return value", () => {
      const sig = makeSig({ returnType: "None", hasReturnValue: false });
      const result = buildGoogleText(sig, "    ", AUTO_CFG);
      assert.ok(!result.includes("Returns:"), "should not contain Returns section");
    });

    it("omits Returns when no annotation and no return value", () => {
      const sig = makeSig({ returnType: undefined, hasReturnValue: false });
      const result = buildGoogleText(sig, "    ", AUTO_CFG);
      assert.ok(!result.includes("Returns:"), "should not contain Returns section");
    });

    it("includes Returns when no annotation but body returns a value", () => {
      const sig = makeSig({ returnType: undefined, hasReturnValue: true });
      const result = buildGoogleText(sig, "    ", AUTO_CFG);
      assert.ok(result.includes("Returns:"), "should contain Returns section");
    });

    it("includes Yields for generators regardless of hasReturnValue", () => {
      const sig = makeSig({ isGenerator: true, hasReturnValue: false });
      const result = buildGoogleText(sig, "    ", AUTO_CFG);
      assert.ok(result.includes("Yields:"), "should contain Yields section");
    });

    it("always mode still includes Returns for -> None", () => {
      const sig = makeSig({ returnType: "None", hasReturnValue: false });
      const result = buildGoogleText(sig, "    ", ALWAYS_CFG);
      assert.ok(result.includes("Returns:"), "should contain Returns section");
    });

    it("includes Returns when annotation is non-None even without return in body", () => {
      const sig = makeSig({ returnType: "int", hasReturnValue: false });
      const result = buildGoogleText(sig, "    ", AUTO_CFG);
      assert.ok(result.includes("Returns:"), "should contain Returns section for -> int");
      assert.ok(result.includes("int:"), "should show the annotated type");
    });

    it("omits Returns when annotation is None and body has no return value", () => {
      const sig = makeSig({ returnType: "None", hasReturnValue: false });
      const result = buildGoogleText(sig, "    ", AUTO_CFG);
      assert.ok(!result.includes("Returns:"), "should not contain Returns section");
    });
  });

  describe("NumPy builder", () => {
    it("includes Returns when body returns a value", () => {
      const sig = makeSig({ returnType: "str", hasReturnValue: true });
      const result = buildNumpyText(sig, "    ", AUTO_CFG);
      assert.ok(result.includes("Returns"), "should contain Returns section");
    });

    it("omits Returns when body has no return value", () => {
      const sig = makeSig({ returnType: "None", hasReturnValue: false });
      const result = buildNumpyText(sig, "    ", AUTO_CFG);
      assert.ok(!result.includes("Returns"), "should not contain Returns section");
    });

    it("omits Returns when no annotation and no return value", () => {
      const sig = makeSig({ hasReturnValue: false });
      const result = buildNumpyText(sig, "    ", AUTO_CFG);
      assert.ok(!result.includes("Returns"), "should not contain Returns section");
    });

    it("includes Returns when annotation is non-None even without return in body", () => {
      const sig = makeSig({ returnType: "int", hasReturnValue: false });
      const result = buildNumpyText(sig, "    ", AUTO_CFG);
      assert.ok(result.includes("Returns"), "should contain Returns section");
    });
  });

  describe("Sphinx builder", () => {
    it("includes :returns: when body returns a value", () => {
      const sig = makeSig({ returnType: "bool", hasReturnValue: true });
      const result = buildSphinxText(sig, "    ", AUTO_CFG);
      assert.ok(result.includes(":returns:"), "should contain :returns:");
      assert.ok(result.includes(":rtype: bool"), "should contain :rtype:");
    });

    it("omits :returns: when body has no return value", () => {
      const sig = makeSig({ returnType: "None", hasReturnValue: false });
      const result = buildSphinxText(sig, "    ", AUTO_CFG);
      assert.ok(!result.includes(":returns:"), "should not contain :returns:");
    });

    it("omits :returns: when no annotation and no return value", () => {
      const sig = makeSig({ hasReturnValue: false });
      const result = buildSphinxText(sig, "    ", AUTO_CFG);
      assert.ok(!result.includes(":returns:"), "should not contain :returns:");
    });

    it("includes :returns: when annotation is non-None even without return in body", () => {
      const sig = makeSig({ returnType: "int", hasReturnValue: false });
      const result = buildSphinxText(sig, "    ", AUTO_CFG);
      assert.ok(result.includes(":returns:"), "should contain :returns:");
      assert.ok(result.includes(":rtype: int"), "should contain :rtype:");
    });
  });

  describe("merger", () => {
    function makeParsed(overrides: Partial<ParsedDocstring> = {}): ParsedDocstring {
      return {
        format: "google",
        summary: "Do something.",
        extendedSummary: [],
        args: [],
        returns: undefined,
        yields: undefined,
        raises: [],
        customSections: [],
        indent: "    ",
        innerIndent: "        ",
        quoteStyle: "double",
        ...overrides,
      };
    }

    it("adds Returns when body returns a value", () => {
      const sig = makeSig({ returnType: "int", hasReturnValue: true });
      const parsed = makeParsed();
      const result = mergeDocstring(parsed, sig, AUTO_CFG);
      assert.ok(result.returns, "should have returns");
      assert.equal(result.returns!.type, "int");
    });

    it("omits Returns when body has no return value", () => {
      const sig = makeSig({ returnType: "None", hasReturnValue: false });
      const parsed = makeParsed();
      const result = mergeDocstring(parsed, sig, AUTO_CFG);
      assert.equal(result.returns, undefined, "should not have returns");
    });

    it("removes existing Returns when body no longer returns a value", () => {
      const sig = makeSig({ returnType: "None", hasReturnValue: false });
      const parsed = makeParsed({
        returns: { type: "int", description: "the old value" },
      });
      const result = mergeDocstring(parsed, sig, AUTO_CFG);
      assert.equal(result.returns, undefined, "should remove returns");
    });

    it("preserves existing Returns description when body still returns a value", () => {
      const sig = makeSig({ returnType: "str", hasReturnValue: true });
      const parsed = makeParsed({
        returns: { type: "int", description: "the result" },
      });
      const result = mergeDocstring(parsed, sig, AUTO_CFG);
      assert.ok(result.returns, "should have returns");
      assert.equal(result.returns!.type, "str");
      assert.equal(result.returns!.description, "the result");
    });

    it("keeps Yields for generators even without hasReturnValue", () => {
      const sig = makeSig({ isGenerator: true, hasReturnValue: false });
      const parsed = makeParsed();
      const result = mergeDocstring(parsed, sig, AUTO_CFG);
      assert.ok(result.yields, "should have yields");
    });

    it("includes Returns when annotation is non-None even without return in body", () => {
      const sig = makeSig({ returnType: "int", hasReturnValue: false });
      const parsed = makeParsed();
      const result = mergeDocstring(parsed, sig, AUTO_CFG);
      assert.ok(result.returns, "should have returns");
      assert.equal(result.returns!.type, "int");
    });
  });
});
