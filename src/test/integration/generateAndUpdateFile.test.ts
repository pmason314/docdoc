import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, before } from "mocha";
import {
  applyGenerateAndUpdateOperations,
  getGenerateAndUpdateOperations,
  initParser,
} from "../../parser/index.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

describe("generateAndUpdate integration", () => {
  before(initParser);

  it("generates missing and updates existing docstrings in one pass", () => {
    const inputText = readFileSync(join(FIXTURES_DIR, "basic.input.py"), "utf8");
    const expectedText = readFileSync(join(FIXTURES_DIR, "basic.expected.py"), "utf8");

    const lines = inputText.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();

    const { generated, updated, ops } = getGenerateAndUpdateOperations(lines, {
      generateModuleDocstring: false,
    });

    // All functions in basic.input.py are undocumented, so only generation expected
    assert.ok(generated > 0, `Expected generated docstrings, got ${generated}`);
    assert.strictEqual(updated, 0, `Expected no updates, got ${updated}`);
    assert.ok(ops.length > 0, "Expected non-empty operations");

    const resultLines = applyGenerateAndUpdateOperations(lines, ops);
    const result = resultLines.join("\n") + "\n";

    assert.equal(result, expectedText);
  });
});
