import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "mocha";
import { applyInsertions, generateFileInsertions } from "../../parser";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

/**
 * For every *.input.py in fixtures/, run generateFileInsertions + applyInsertions
 * and compare against the matching *.expected.py.
 *
 * TODO (Phase 7): once Raises detection is implemented, update basic.expected.py so
 * that func_with_params includes a Raises section for the ValueError it may raise.
 */
describe("generateFile integration", () => {
  const inputs = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".input.py"));

  for (const inputFile of inputs) {
    const baseName = inputFile.replace(".input.py", "");
    const expectedFile = `${baseName}.expected.py`;

    it(baseName, () => {
      const inputText = readFileSync(join(FIXTURES_DIR, inputFile), "utf8");
      const expectedText = readFileSync(join(FIXTURES_DIR, expectedFile), "utf8");

      const lines = inputText.split("\n");
      if (lines[lines.length - 1] === "") lines.pop();

      const insertions = generateFileInsertions(lines);
      const resultLines = applyInsertions(lines, insertions);
      const result = resultLines.join("\n") + "\n";

      assert.equal(result, expectedText);
    });
  }
});
