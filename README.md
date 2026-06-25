# Docdoc — Python Docstring Generator

Automatically generate, update, and convert Python docstrings in **Google**, **NumPy**, or **Sphinx** style.

## Features

### Inline trigger
Type `"""` or `'''` on the line inside a function or class body to instantly get a docstring completion populated from the signature. Press `Tab` to confirm the suggestion, then press `Tab` again to jump between each placeholder field for function summaries, parameter descriptions, and so on.

### Commands
All commands are available via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) when a Python file is open.

| Command                                      | Description                                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Python: Generate Docstring**               | Insert a docstring for the function or class at the cursor                                                                         |
| **Python: Generate All Docstrings for File** | Insert docstrings for every undocumented function and class in the file                                                            |
| **Python: Update Docstring**                 | Re-sync the docstring at the cursor with the current signature, adding docstring fields for new parameters and removing stale ones |
| **Python: Update All Docstrings in File**    | Re-sync every docstring in the file, adding docstring fields for new parameters and removing stale ones                            |
| **Python: Convert Docstring Format**         | Convert the docstring at the cursor to the configured format                                                                       |
| **Python: Convert All Docstrings in File**   | Convert every docstring in the file to the configured format                                                                       |

### Lightbulb quick fix
A lightbulb code action for generating a docstring appears next to any undocumented function or class.

### On-save generation
New docstrings can be generated and/or updated automatically for all undocumented functions and classes whenever a file is saved (disabled by default).

---

## Supported Formats

**Google**
```python
def add(x: int, y: int) -> int:
    """Add two numbers.

    Args:
        x (int): The first number.
        y (int): The second number.

    Returns:
        int: _description_
    """
```

**NumPy**
```python
def add(x: int, y: int) -> int:
    """Add two numbers.

    Parameters
    ----------
    x : int
        The first number.
    y : int
        The second number.

    Returns
    -------
    int
        _description_
    """
```

**Sphinx**
```python
def add(x: int, y: int) -> int:
    """Add two numbers.

    :param x: The first number.
    :type x: int
    :param y: The second number.
    :type y: int
    :returns: _description_
    :rtype: int
    """
```

---

## Auto-detect Format

Set `docdoc.format` to `"auto"` (the default) and the extension will read your `pyproject.toml` to detect which docstring convention your project uses. If none is found, Google style is used.

---

## Configuration

| Setting                              | Default           | Description                                                                                                                           |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `docdoc.format`                      | `"auto"`          | Docstring format: `auto`, `google`, `numpy`, or `sphinx`                                                                              |
| `docdoc.quoteStyle`                  | `"double"`        | Quote style: `double` (`"""`) or `single` (`'''`)                                                                                     |
| `docdoc.includeTypesFromAnnotations` | `true`            | Include type info in the docstring when a type annotation is present                                                                  |
| `docdoc.includeDefaults`             | `true`            | Append `Defaults to X.` when a parameter has a default value                                                                          |
| `docdoc.returns.mode`                | `"auto"`          | `always` — always include a Returns/Yields section; `auto` — only when the function body returns a value or has a non-None annotation |
| `docdoc.generateModuleDocstring`     | `true`            | Also insert a module-level docstring when running Generate All                                                                        |
| `docdoc.onSave.enable`               | `false`           | Auto-generate docstrings for undocumented functions and classes on save                                                               |
| `docdoc.placeholders.summary`        | `"_summary_"`     | Placeholder text for the summary line                                                                                                 |
| `docdoc.placeholders.description`    | `"_description_"` | Placeholder text for parameter and return descriptions                                                                                |

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (via nvm or similar)
- npm (bundled with Node.js)

### Setup

```sh
git clone https://github.com/pmason314/docdoc.git
cd docdoc
npm install
```

### Building

```sh
npm run compile    # one-off build
npm run watch      # rebuild on file changes
```

### Running the Extension

Press `F5` in VS Code (or **Run → Start Debugging**) to launch an Extension Development Host window with the extension loaded. Any changes require recompiling and reloading the host (`Ctrl+Shift+P` → **Developer: Reload Window**).

### Testing

```sh
npm test                  # all tests
npm run test:unit         # unit tests only
npm run test:integration  # integration tests only
```

### Linting

```sh
npm run lint
```

---

## License

[GNU General Public License v3](https://www.gnu.org/licenses/gpl-3.0.html)
