import { expect } from "chai";
import {
  detectRuffStyleFromPyprojectToml,
  detectRuffStyleFromRuffToml,
} from "../../../config/ruffStyleDetector.js";

describe("ruffStyleDetector", () => {
  describe("detectRuffStyleFromPyprojectToml", () => {
    it("should return defaults when no ruff config exists", async () => {
      const toml = `
[tool.black]
line-length = 120
`;
      const style = await detectRuffStyleFromPyprojectToml(toml);
      expect(style.startOnNewLine).to.be.false;
      expect(style.collapseOneLiners).to.be.true;
    });

    it("should detect startOnNewLine when D213 is in extend-select", async () => {
      const toml = `
[tool.ruff.lint]
extend-select = ["D213"]
`;
      const style = await detectRuffStyleFromPyprojectToml(toml);
      expect(style.startOnNewLine).to.be.true;
    });

    it("should detect startOnNewLine when D212 is in extend-ignore", async () => {
      const toml = `
[tool.ruff.lint]
extend-ignore = ["D212"]
`;
      const style = await detectRuffStyleFromPyprojectToml(toml);
      expect(style.startOnNewLine).to.be.true;
    });

    it("should not set startOnNewLine when D212 is active", async () => {
      const toml = `
[tool.ruff.lint]
select = ["D212"]
`;
      const style = await detectRuffStyleFromPyprojectToml(toml);
      expect(style.startOnNewLine).to.be.false;
    });

    it("should disable collapseOneLiners when D200 is ignored", async () => {
      const toml = `
[tool.ruff.lint]
extend-ignore = ["D200"]
`;
      const style = await detectRuffStyleFromPyprojectToml(toml);
      expect(style.collapseOneLiners).to.be.false;
    });

    it("should keep collapseOneLiners true when D200 is not ignored", async () => {
      const toml = `
[tool.ruff.lint]
select = ["D"]
`;
      const style = await detectRuffStyleFromPyprojectToml(toml);
      expect(style.collapseOneLiners).to.be.true;
    });

    it("should return defaults for invalid TOML", async () => {
      const style = await detectRuffStyleFromPyprojectToml("not valid");
      expect(style.startOnNewLine).to.be.false;
      expect(style.collapseOneLiners).to.be.true;
    });

    it("should return defaults for empty content", async () => {
      const style = await detectRuffStyleFromPyprojectToml("");
      expect(style.startOnNewLine).to.be.false;
      expect(style.collapseOneLiners).to.be.true;
    });

    it("should handle combined D212 ignore and D213 select", async () => {
      const toml = `
[tool.ruff.lint]
extend-ignore = ["D212"]
extend-select = ["D213"]
`;
      const style = await detectRuffStyleFromPyprojectToml(toml);
      expect(style.startOnNewLine).to.be.true;
    });
  });

  describe("detectRuffStyleFromRuffToml", () => {
    it("should detect from lint section in ruff.toml", async () => {
      const toml = `
[lint]
extend-select = ["D213"]
extend-ignore = ["D200"]
`;
      const style = await detectRuffStyleFromRuffToml(toml);
      expect(style.startOnNewLine).to.be.true;
      expect(style.collapseOneLiners).to.be.false;
    });

    it("should return defaults when no lint config", async () => {
      const toml = `
line-length = 120
`;
      const style = await detectRuffStyleFromRuffToml(toml);
      expect(style.startOnNewLine).to.be.false;
      expect(style.collapseOneLiners).to.be.true;
    });
  });
});
