import { expect } from "chai";
import {
  detectFormatFromPyprojectToml,
  detectFormatFromRuffToml,
  detectFormatFromSetupCfg,
} from "../../../config/formatDetector.js";

describe("formatDetector", () => {
  describe("detectFormatFromPyprojectToml", () => {
    it("should detect google from ruff.lint.pydocstyle convention", async () => {
      const toml = `
[tool.ruff.lint.pydocstyle]
convention = "google"
`;
      expect(await detectFormatFromPyprojectToml(toml)).to.equal("google");
    });

    it("should detect numpy from ruff.lint.pydocstyle convention", async () => {
      const toml = `
[tool.ruff.lint.pydocstyle]
convention = "numpy"
`;
      expect(await detectFormatFromPyprojectToml(toml)).to.equal("numpy");
    });

    it("should map pep257 to google", async () => {
      const toml = `
[tool.ruff.lint.pydocstyle]
convention = "pep257"
`;
      expect(await detectFormatFromPyprojectToml(toml)).to.equal("google");
    });

    it("should detect from tool.pydocstyle convention", async () => {
      const toml = `
[tool.pydocstyle]
convention = "numpy"
`;
      expect(await detectFormatFromPyprojectToml(toml)).to.equal("numpy");
    });

    it("should detect from tool.pylint.format docstring-convention", async () => {
      const toml = `
[tool.pylint.format]
docstring-convention = "google"
`;
      expect(await detectFormatFromPyprojectToml(toml)).to.equal("google");
    });

    it("should prioritize ruff over pydocstyle", async () => {
      const toml = `
[tool.ruff.lint.pydocstyle]
convention = "google"

[tool.pydocstyle]
convention = "numpy"
`;
      expect(await detectFormatFromPyprojectToml(toml)).to.equal("google");
    });

    it("should return null when no convention is set", async () => {
      const toml = `
[tool.ruff]
line-length = 120
`;
      expect(await detectFormatFromPyprojectToml(toml)).to.be.null;
    });

    it("should return null for empty content", async () => {
      expect(await detectFormatFromPyprojectToml("")).to.be.null;
    });

    it("should return null for invalid TOML", async () => {
      expect(await detectFormatFromPyprojectToml("not valid [toml")).to.be.null;
    });

    it("should return null for unrecognized convention", async () => {
      const toml = `
[tool.ruff.lint.pydocstyle]
convention = "javadoc"
`;
      expect(await detectFormatFromPyprojectToml(toml)).to.be.null;
    });
  });

  describe("detectFormatFromRuffToml", () => {
    it("should detect from lint.pydocstyle convention", async () => {
      const toml = `
[lint.pydocstyle]
convention = "numpy"
`;
      expect(await detectFormatFromRuffToml(toml)).to.equal("numpy");
    });

    it("should return null when no convention is set", async () => {
      const toml = `
line-length = 120
`;
      expect(await detectFormatFromRuffToml(toml)).to.be.null;
    });

    it("should return null for invalid TOML", async () => {
      expect(await detectFormatFromRuffToml("{{bad}}")).to.be.null;
    });
  });

  describe("detectFormatFromSetupCfg", () => {
    it("should detect from [pydocstyle] section", () => {
      const cfg = `
[pydocstyle]
convention = numpy
`;
      expect(detectFormatFromSetupCfg(cfg)).to.equal("numpy");
    });

    it("should handle spaces around equals", () => {
      const cfg = `
[pydocstyle]
convention = google
`;
      expect(detectFormatFromSetupCfg(cfg)).to.equal("google");
    });

    it("should ignore other sections", () => {
      const cfg = `
[flake8]
convention = numpy

[pydocstyle]
convention = google
`;
      expect(detectFormatFromSetupCfg(cfg)).to.equal("google");
    });

    it("should return null when no pydocstyle section exists", () => {
      const cfg = `
[flake8]
max-line-length = 120
`;
      expect(detectFormatFromSetupCfg(cfg)).to.be.null;
    });

    it("should return null for empty content", () => {
      expect(detectFormatFromSetupCfg("")).to.be.null;
    });
  });
});
