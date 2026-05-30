import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "mocha";
import {
  DEF_RE,
  CLASS_RE,
  findSignatureFromLines,
  buildUpdateText,
  isGeneratorFunction,
} from "../../parser";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

/**
 * For every *.update-input.py in fixtures/, run the update transform on every
 * documented def/class and compare against the matching *.update-expected.py.
 *
 * The transform mirrors what `updateFile` does in commands.ts:
 * find each def/class line → buildUpdateText → splice the replacement in.
 *
 * TODO (Phase 7): once Raises detection is implemented, update fixtures to
 * include Raises sections where appropriate.
 */
describe("updateFile integration", () => {
  const inputs = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".update-input.py"));

  // Also handle the simpler naming used by the basic fixture pair
  const plainInputs = readdirSync(FIXTURES_DIR).filter(
    (f) => f.endsWith(".input.py") && !f.endsWith(".update-input.py"),
  );

  function runUpdateTransform(inputText: string): string {
    const lines = inputText.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();

    const result = [...lines];
    let offset = 0;

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      if (!DEF_RE.test(text) && !CLASS_RE.test(text)) continue;

      const found = findSignatureFromLines(lines, i);
      if (!found || found.defLine !== i) continue;

      const isGen = isGeneratorFunction(lines, found.defLine, found.defLine + 1);
      const upd = buildUpdateText(lines, i, { isGenerator: isGen });
      if (!upd) continue;

      const startInResult = upd.startLine + offset;
      const endInResult = upd.endLine + offset;
      const newLines = upd.text.split("\n");
      result.splice(startInResult, endInResult - startInResult + 1, ...newLines);
      offset += newLines.length - (endInResult - startInResult + 1);
    }

    return result.join("\n") + "\n";
  }

  for (const inputFile of inputs) {
    const baseName = inputFile.replace(".update-input.py", "");
    const expectedFile = `${baseName}.update-expected.py`;

    it(baseName, () => {
      const inputText = readFileSync(join(FIXTURES_DIR, inputFile), "utf8");
      const expectedText = readFileSync(join(FIXTURES_DIR, expectedFile), "utf8");
      assert.equal(runUpdateTransform(inputText), expectedText);
    });
  }

  it("update (basic fixtures)", () => {
    const inputText = readFileSync(join(FIXTURES_DIR, "update.input.py"), "utf8");
    const expectedText = readFileSync(join(FIXTURES_DIR, "update.expected.py"), "utf8");
    assert.equal(runUpdateTransform(inputText), expectedText);
  });
});
