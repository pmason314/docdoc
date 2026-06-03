import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, before } from "mocha";
import { applyInsertions, generateFileInsertions, initParser } from "../../parser/index.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

/**
 * For every *.input.py in fixtures/ (excluding *.update-* files),
 * run generateFileInsertions + applyInsertions and compare against the matching *.expected.py.
 */
describe("generateFile integration", () => {
  before(initParser);

  const inputs = readdirSync(FIXTURES_DIR).filter(
    (f) => f.endsWith(".input.py") && !f.includes(".update-") && f !== "update.input.py",
  );

  for (const inputFile of inputs) {
    const baseName = inputFile.replace(".input.py", "");
    const expectedFile = `${baseName}.expected.py`;

    it(baseName, () => {
      const inputText = readFileSync(join(FIXTURES_DIR, inputFile), "utf8");
      const expectedPath = join(FIXTURES_DIR, expectedFile);
      if (!require("node:fs").existsSync(expectedPath)) {
        console.log(`⚠️  Skipping ${baseName}: no expected file`);
        return;
      }
      const expectedText = readFileSync(expectedPath, "utf8");

      const lines = inputText.split("\n");
      if (lines[lines.length - 1] === "") lines.pop();

      const insertions = generateFileInsertions(lines, { generateModuleDocstring: false });
      const resultLines = applyInsertions(lines, insertions);
      const result = resultLines.join("\n") + "\n";

      assert.equal(result, expectedText);
    });
  }
});
