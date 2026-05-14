import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension", () => {
  test("should activate on Python language", async () => {
    const ext = vscode.extensions.getExtension("pmason314.python-docstring-generator");
    assert.ok(ext, "Extension should be found");
  });

  test("should register all commands", async () => {
    const commands = await vscode.commands.getCommands(true);
    const expected = [
      "docstringGenerator.generate",
      "docstringGenerator.generateFile",
      "docstringGenerator.update",
      "docstringGenerator.updateFile",
      "docstringGenerator.convertFormat",
      "docstringGenerator.convertFileFormat",
    ];
    for (const cmd of expected) {
      assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
    }
  });
});
