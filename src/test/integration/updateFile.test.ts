import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, before } from "mocha";
import { applyReplacements, getUpdateOperations, initParser } from "../../parser/index.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

/**
 * For every *.update-input.py in fixtures/, run the update transform
 * on every documented def/class and compare against the matching *.update-expected.py.
 * Also runs update on update.input.py (the legacy naming).
 */
describe("updateFile integration", () => {
  before(initParser);

  const inputs = readdirSync(FIXTURES_DIR).filter((f) => {
    return f.endsWith(".update-input.py") || f === "update.input.py";
  });

  for (const inputFile of inputs) {
    const baseName = inputFile.replace(".update-input.py", "").replace(".input.py", "");
    const expectedFile = inputFile.endsWith(".update-input.py")
      ? `${baseName}.update-expected.py`
      : `${baseName}.expected.py`;

    it(`update: ${baseName}`, () => {
      const inputText = readFileSync(join(FIXTURES_DIR, inputFile), "utf8");
      const expectedPath = join(FIXTURES_DIR, expectedFile);
      if (!require("node:fs").existsSync(expectedPath)) {
        console.log(`⚠️  Skipping ${baseName}: no expected file`);
        return;
      }
      const expectedText = readFileSync(expectedPath, "utf8");

      const lines = inputText.split("\n");
      if (lines[lines.length - 1] === "") lines.pop();

      const ops = getUpdateOperations(lines);
      const resultLines = applyReplacements(lines, ops);
      const result = resultLines.join("\n") + "\n";

      assert.equal(result, expectedText);
    });
  }
});
