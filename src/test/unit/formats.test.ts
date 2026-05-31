import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  buildNumpyDocstring,
  buildNumpyDocstringText,
  buildSphinxDocstring,
  buildSphinxDocstringText,
  buildDocstring,
  buildDocstringText,
  type ParsedSignature,
} from "../../parser";
import { parseNumpyDocstring, parseSphinxDocstring } from "../../docstringParser";

const INDENT = "    ";
const Q = '"""';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sig(
  params: ParsedSignature["params"] = [],
  returnAnnotation: string | null = null,
): ParsedSignature {
  return { kind: "def", name: "f", params, returnAnnotation };
}

// ---------------------------------------------------------------------------
// buildNumpyDocstringText
// ---------------------------------------------------------------------------

describe("buildNumpyDocstringText", () => {
  it("no params, no return — one-liner", () => {
    const out = buildNumpyDocstringText(sig(), INDENT, Q, { returnsMode: "non-none" });
    assert.equal(out, `${INDENT}${Q}_summary_.${Q}`);
  });

  it("unannotated return — includes Returns section (always mode)", () => {
    const out = buildNumpyDocstringText(sig([], null), INDENT, Q);
    assert.ok(out.includes("Returns\n    -------\n"));
    assert.ok(out.includes("_description_"));
  });

  it("with params — Parameters section", () => {
    const out = buildNumpyDocstringText(
      sig([{ name: "x", annotation: "int", hasDefault: false }]),
      INDENT,
      Q,
      { returnsMode: "non-none" },
    );
    assert.ok(out.includes(`${INDENT}Parameters\n${INDENT}----------\n`));
    assert.ok(out.includes(`${INDENT}x : int\n`));
    assert.ok(out.includes(`${INDENT}    _description_\n`));
  });

  it("return annotation — Returns section with type on its own line", () => {
    const out = buildNumpyDocstringText(sig([], "bool"), INDENT, Q, {
      returnsMode: "non-none",
    });
    assert.ok(out.includes(`${INDENT}Returns\n${INDENT}-------\n`));
    assert.ok(out.includes(`${INDENT}bool\n`));
    assert.ok(out.includes(`${INDENT}    _description_\n`));
  });

  it("None return — no Returns section (non-none mode)", () => {
    const out = buildNumpyDocstringText(sig([], "None"), INDENT, Q, {
      returnsMode: "non-none",
    });
    assert.ok(!out.includes("Returns"));
  });

  it("generator — Yields section", () => {
    const out = buildNumpyDocstringText(sig([], "int"), INDENT, Q, {
      isGenerator: true,
      returnsMode: "non-none",
    });
    assert.ok(out.includes(`${INDENT}Yields\n${INDENT}------\n`));
    assert.ok(!out.includes("Returns"));
  });

  it("includeTypes=false omits type from Parameters", () => {
    const out = buildNumpyDocstringText(
      sig([{ name: "x", annotation: "int", hasDefault: false }]),
      INDENT,
      Q,
      { includeTypes: false, returnsMode: "non-none" },
    );
    assert.ok(out.includes(`${INDENT}x\n`));
    assert.ok(!out.includes("int"));
  });

  it("includeDefaults appends Defaults note", () => {
    const out = buildNumpyDocstringText(
      sig([{ name: "x", annotation: "int", hasDefault: true, defaultValue: "42" }]),
      INDENT,
      Q,
      { returnsMode: "non-none" },
    );
    assert.ok(out.includes("Defaults to 42."));
  });
});

// ---------------------------------------------------------------------------
// buildSphinxDocstringText
// ---------------------------------------------------------------------------

describe("buildSphinxDocstringText", () => {
  it("no params, no return — one-liner", () => {
    const out = buildSphinxDocstringText(sig(), INDENT, Q, { returnsMode: "non-none" });
    assert.equal(out, `${INDENT}${Q}_summary_.${Q}`);
  });

  it("unannotated return — includes :returns: (always mode)", () => {
    const out = buildSphinxDocstringText(sig([], null), INDENT, Q);
    assert.ok(out.includes(`:returns:`));
  });

  it("with params — :param: and :type: fields", () => {
    const out = buildSphinxDocstringText(
      sig([{ name: "x", annotation: "int", hasDefault: false }]),
      INDENT,
      Q,
      { returnsMode: "non-none" },
    );
    assert.ok(out.includes(`${INDENT}:param x:`));
    assert.ok(out.includes(`${INDENT}:type x: int\n`));
  });

  it("includeTypes=false omits :type: fields", () => {
    const out = buildSphinxDocstringText(
      sig([{ name: "x", annotation: "int", hasDefault: false }]),
      INDENT,
      Q,
      { includeTypes: false, returnsMode: "non-none" },
    );
    assert.ok(out.includes(`:param x:`));
    assert.ok(!out.includes(":type x:"));
  });

  it("return annotation — :returns: and :rtype:", () => {
    const out = buildSphinxDocstringText(sig([], "bool"), INDENT, Q, {
      returnsMode: "non-none",
    });
    assert.ok(out.includes(`${INDENT}:returns:`));
    assert.ok(out.includes(`${INDENT}:rtype: bool\n`));
  });

  it("None return — no :returns: (non-none mode)", () => {
    const out = buildSphinxDocstringText(sig([], "None"), INDENT, Q, {
      returnsMode: "non-none",
    });
    assert.ok(!out.includes(":returns:"));
    assert.ok(!out.includes(":rtype:"));
  });

  it("includeDefaults appends Defaults note to :param:", () => {
    const out = buildSphinxDocstringText(
      sig([{ name: "x", annotation: "int", hasDefault: true, defaultValue: "42" }]),
      INDENT,
      Q,
      { returnsMode: "non-none" },
    );
    assert.ok(out.includes("Defaults to 42."));
  });
});

// ---------------------------------------------------------------------------
// buildDocstring / buildDocstringText dispatch
// ---------------------------------------------------------------------------

describe("buildDocstring dispatch", () => {
  const simpleSig = sig([{ name: "a", annotation: "int", hasDefault: false }], "bool");

  it("format='google' uses Google builder", () => {
    const out = buildDocstring(simpleSig, INDENT, Q, { format: "google", returnsMode: "non-none" });
    assert.ok(out.includes("Args:"));
    assert.ok(out.includes("a (int):"));
  });

  it("format='numpy' uses NumPy builder", () => {
    const out = buildDocstring(simpleSig, INDENT, Q, { format: "numpy", returnsMode: "non-none" });
    assert.ok(out.includes("Parameters"));
    assert.ok(out.includes("a : int"));
  });

  it("format='sphinx' uses Sphinx builder", () => {
    const out = buildDocstring(simpleSig, INDENT, Q, {
      format: "sphinx",
      returnsMode: "non-none",
    });
    assert.ok(out.includes(":param a:"));
    assert.ok(out.includes(":type a: int"));
  });

  it("format='auto' falls back to Google", () => {
    const out = buildDocstring(simpleSig, INDENT, Q, { format: "auto", returnsMode: "non-none" });
    assert.ok(out.includes("Args:"));
  });

  it("buildDocstringText format='numpy'", () => {
    const out = buildDocstringText(simpleSig, INDENT, Q, {
      format: "numpy",
      returnsMode: "non-none",
    });
    assert.ok(out.includes(`${INDENT}Parameters\n`));
  });

  it("buildDocstringText format='sphinx'", () => {
    const out = buildDocstringText(simpleSig, INDENT, Q, {
      format: "sphinx",
      returnsMode: "non-none",
    });
    assert.ok(out.includes(`:param a:`));
  });
});

// ---------------------------------------------------------------------------
// parseNumpyDocstring
// ---------------------------------------------------------------------------

describe("parseNumpyDocstring", () => {
  it("returns null for non-docstring line", () => {
    assert.equal(parseNumpyDocstring(["x = 1"], 0), null);
  });

  it("one-liner", () => {
    const r = parseNumpyDocstring(['    """_summary_"""'], 0);
    assert.ok(r !== null);
    assert.equal(r.parsed.summary, "_summary_");
    assert.equal(r.startLine, 0);
    assert.equal(r.endLine, 0);
  });

  it("parses Parameters section", () => {
    const lines = [
      '    """_summary_.',
      "",
      "    Parameters",
      "    ----------",
      "    x : int",
      "        The value.",
      '    """',
    ];
    const r = parseNumpyDocstring(lines, 0);
    assert.ok(r !== null);
    assert.equal(r.parsed.params.length, 1);
    assert.equal(r.parsed.params[0].name, "x");
    assert.equal(r.parsed.params[0].typehint, "int");
    assert.equal(r.parsed.params[0].description, "The value.");
  });

  it("parses Returns section with type line", () => {
    const lines = [
      '    """_summary_.',
      "",
      "    Returns",
      "    -------",
      "    bool",
      "        True if ok.",
      '    """',
    ];
    const r = parseNumpyDocstring(lines, 0);
    assert.ok(r !== null);
    assert.ok(r.parsed.returns !== null);
    assert.equal(r.parsed.returns!.typehint, "bool");
    assert.equal(r.parsed.returns!.description, "True if ok.");
  });

  it("parses Yields section", () => {
    const lines = [
      '    """_summary_.',
      "",
      "    Yields",
      "    ------",
      "    int",
      "        The next value.",
      '    """',
    ];
    const r = parseNumpyDocstring(lines, 0);
    assert.ok(r !== null);
    assert.ok(r.parsed.yields !== null);
    assert.equal(r.parsed.yields!.typehint, "int");
  });

  it("parses Raises section", () => {
    const lines = [
      '    """_summary_.',
      "",
      "    Raises",
      "    ------",
      "    ValueError",
      "        If bad.",
      '    """',
    ];
    const r = parseNumpyDocstring(lines, 0);
    assert.ok(r !== null);
    assert.equal(r.parsed.raises.length, 1);
    assert.equal(r.parsed.raises[0].exception, "ValueError");
  });

  it("preserves unknown sections", () => {
    const lines = ['    """_summary_.', "", "    Notes", "    -----", "    Some note.", '    """'];
    const r = parseNumpyDocstring(lines, 0);
    assert.ok(r !== null);
    assert.equal(r.parsed.unknownSections.length, 1);
    assert.equal(r.parsed.unknownSections[0].header, "Notes");
  });

  it("extracts indent and quoteChar", () => {
    const r = parseNumpyDocstring(['    """_summary_"""'], 0);
    assert.ok(r !== null);
    assert.equal(r.indent, "    ");
    assert.equal(r.quoteChar, '"""');
  });
});

// ---------------------------------------------------------------------------
// parseSphinxDocstring
// ---------------------------------------------------------------------------

describe("parseSphinxDocstring", () => {
  it("returns null for non-docstring line", () => {
    assert.equal(parseSphinxDocstring(["x = 1"], 0), null);
  });

  it("one-liner", () => {
    const r = parseSphinxDocstring(['    """_summary_"""'], 0);
    assert.ok(r !== null);
    assert.equal(r.parsed.summary, "_summary_");
    assert.equal(r.startLine, 0);
    assert.equal(r.endLine, 0);
  });

  it("parses :param: fields", () => {
    const lines = [
      '    """_summary_.',
      "",
      "    :param x: The value.",
      "    :type x: int",
      '    """',
    ];
    const r = parseSphinxDocstring(lines, 0);
    assert.ok(r !== null);
    assert.equal(r.parsed.params.length, 1);
    assert.equal(r.parsed.params[0].name, "x");
    assert.equal(r.parsed.params[0].typehint, "int");
    assert.equal(r.parsed.params[0].description, "The value.");
  });

  it("param without :type: has null typehint", () => {
    const lines = ['    """_summary_.', "", "    :param x: The value.", '    """'];
    const r = parseSphinxDocstring(lines, 0);
    assert.ok(r !== null);
    assert.equal(r.parsed.params[0].typehint, null);
  });

  it("parses :returns: and :rtype:", () => {
    const lines = [
      '    """_summary_.',
      "",
      "    :returns: The result.",
      "    :rtype: bool",
      '    """',
    ];
    const r = parseSphinxDocstring(lines, 0);
    assert.ok(r !== null);
    assert.ok(r.parsed.returns !== null);
    assert.equal(r.parsed.returns!.description, "The result.");
    assert.equal(r.parsed.returns!.typehint, "bool");
  });

  it(":returns: without :rtype: has null typehint", () => {
    const lines = ['    """_summary_.', "", "    :returns: Something.", '    """'];
    const r = parseSphinxDocstring(lines, 0);
    assert.ok(r !== null);
    assert.ok(r.parsed.returns !== null);
    assert.equal(r.parsed.returns!.typehint, null);
  });

  it("parses :raises:", () => {
    const lines = ['    """_summary_.', "", "    :raises ValueError: If bad input.", '    """'];
    const r = parseSphinxDocstring(lines, 0);
    assert.ok(r !== null);
    assert.equal(r.parsed.raises.length, 1);
    assert.equal(r.parsed.raises[0].exception, "ValueError");
    assert.equal(r.parsed.raises[0].description, "If bad input.");
  });

  it("no fields — no params or returns", () => {
    const lines = ['    """_summary_."""'];
    const r = parseSphinxDocstring(lines, 0);
    assert.ok(r !== null);
    assert.deepEqual(r.parsed.params, []);
    assert.equal(r.parsed.returns, null);
  });

  it("extracts indent and quoteChar", () => {
    const r = parseSphinxDocstring(["    '''_summary_'''"], 0);
    assert.ok(r !== null);
    assert.equal(r.indent, "    ");
    assert.equal(r.quoteChar, "'''");
  });
});
