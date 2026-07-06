/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    files: ["src/**/*.ts"],
    ignores: ["src/test/fixtures/**/*.py"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: await import("@typescript-eslint/parser"),
      parserOptions: {
        project: ["./tsconfig.json"],
      },
    },
    plugins: {
      "@typescript-eslint": await import("@typescript-eslint/eslint-plugin"),
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "no-unused-vars": "off",
    },
  },
];
