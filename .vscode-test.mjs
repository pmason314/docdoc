// @ts-check

/** @type {import('@vscode/test-cli').TestConfiguration} */
const config = {
  files: "dist-test/src/test/integration/**/*.test.js",
  version: "stable",
  mocha: {
    ui: "bdd",
    timeout: 10000,
  },
};

export default config;
