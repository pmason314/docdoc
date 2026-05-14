import { expect } from "chai";
import { resolveConfig } from "../../../config/config.js";
import type { RawWorkspaceConfig, ConfigFileContents } from "../../../config/config.js";

function makeRawConfig(overrides: Partial<RawWorkspaceConfig> = {}): RawWorkspaceConfig {
  return {
    format: "",
    quoteStyle: "double",
    "trigger.tripleQuote": true,
    "trigger.codeAction": true,
    "onSave.enable": false,
    includeTypesFromAnnotations: true,
    includeDefaults: true,
    includeExtendedSummary: false,
    "returns.skipNone": true,
    "returns.requireAnnotation": true,
    detectGenerators: true,
    "raises.useSubprocess": true,
    "raises.useSimpleScan": true,
    mergeInitParams: false,
    includeClassAttributes: true,
    "update.removeStaleParams": true,
    "placeholders.summary": "_summary_",
    "placeholders.description": "",
    pythonPath: "",
    "ai.generateSummary": false,
    "ai.generateParamDescriptions": false,
    "ai.generateReturnDescription": false,
    "ai.includeBodyContext": false,
    "ai.maxBodyTokens": 500,
    "ai.modelFamily": "",
    ...overrides,
  };
}

function makeFiles(overrides: Partial<ConfigFileContents> = {}): ConfigFileContents {
  return {
    pyprojectToml: null,
    ruffToml: null,
    setupCfg: null,
    ...overrides,
  };
}

describe("resolveConfig", () => {
  it("should use explicit format when set", async () => {
    const config = await resolveConfig(makeRawConfig({ format: "numpy" }), makeFiles());
    expect(config.format).to.equal("numpy");
  });

  it("should auto-detect format from pyproject.toml when format is empty", async () => {
    const pyprojectToml = `
[tool.ruff.lint.pydocstyle]
convention = "numpy"
`;
    const config = await resolveConfig(makeRawConfig(), makeFiles({ pyprojectToml }));
    expect(config.format).to.equal("numpy");
  });

  it("should fall back to google when no format is configured or detected", async () => {
    const config = await resolveConfig(makeRawConfig(), makeFiles());
    expect(config.format).to.equal("google");
  });

  it("should prefer explicit format over auto-detection", async () => {
    const pyprojectToml = `
[tool.ruff.lint.pydocstyle]
convention = "numpy"
`;
    const config = await resolveConfig(makeRawConfig({ format: "sphinx" }), makeFiles({ pyprojectToml }));
    expect(config.format).to.equal("sphinx");
  });

  it("should pass through all boolean settings", async () => {
    const config = await resolveConfig(
      makeRawConfig({
        includeTypesFromAnnotations: false,
        includeDefaults: false,
        mergeInitParams: true,
      }),
      makeFiles(),
    );
    expect(config.includeTypesFromAnnotations).to.be.false;
    expect(config.includeDefaults).to.be.false;
    expect(config.mergeInitParams).to.be.true;
  });

  it("should resolve ruff style from pyproject.toml", async () => {
    const pyprojectToml = `
[tool.ruff.lint]
extend-select = ["D213"]
extend-ignore = ["D200"]
`;
    const config = await resolveConfig(makeRawConfig(), makeFiles({ pyprojectToml }));
    expect(config.ruff.startOnNewLine).to.be.true;
    expect(config.ruff.collapseOneLiners).to.be.false;
  });

  it("should resolve ruff style from ruff.toml", async () => {
    const ruffToml = `
[lint]
extend-ignore = ["D200"]
`;
    const config = await resolveConfig(makeRawConfig(), makeFiles({ ruffToml }));
    expect(config.ruff.collapseOneLiners).to.be.false;
  });

  it("should handle single quote style", async () => {
    const config = await resolveConfig(makeRawConfig({ quoteStyle: "single" }), makeFiles());
    expect(config.quoteStyle).to.equal("single");
  });

  it("should pass through AI settings", async () => {
    const config = await resolveConfig(
      makeRawConfig({
        "ai.generateSummary": true,
        "ai.maxBodyTokens": 1000,
        "ai.modelFamily": "gpt-4o",
      }),
      makeFiles(),
    );
    expect(config.ai.generateSummary).to.be.true;
    expect(config.ai.maxBodyTokens).to.equal(1000);
    expect(config.ai.modelFamily).to.equal("gpt-4o");
  });

  it("should pass through placeholder settings", async () => {
    const config = await resolveConfig(
      makeRawConfig({
        "placeholders.summary": "TODO",
        "placeholders.description": "TODO",
      }),
      makeFiles(),
    );
    expect(config.placeholders.summary).to.equal("TODO");
    expect(config.placeholders.description).to.equal("TODO");
  });

  it("should fall back through config files in order", async () => {
    // No pyproject, no ruff, but setup.cfg has it
    const setupCfg = `
[pydocstyle]
convention = numpy
`;
    const config = await resolveConfig(makeRawConfig(), makeFiles({ setupCfg }));
    expect(config.format).to.equal("numpy");
  });
});
