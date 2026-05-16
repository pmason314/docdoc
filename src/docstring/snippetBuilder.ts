/**
 * SnippetBuilder — assembles VS Code snippet strings.
 *
 * Escaping rules per the VS Code snippet spec:
 *   - Outer text:      escape `\` and `$`
 *   - Placeholder text inside ${N:…}: also escape `}`
 */

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
}

function escapePlaceholder(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\$/g, "\\$").replace(/}/g, "\\}");
}

export class SnippetBuilder {
  private parts: string[] = [];
  private n = 1;

  /** Append literal text (escaped for snippet syntax). */
  text(s: string): this {
    if (s) this.parts.push(escapeText(s));
    return this;
  }

  /**
   * Append a numbered tab stop.
   * Always uses the `${N:placeholder}` form (placeholder may be empty).
   */
  stop(placeholder = ""): this {
    this.parts.push(`\${${this.n++}:${escapePlaceholder(placeholder)}}`);
    return this;
  }

  /** Append the final cursor position (`$0`). */
  cursor(): this {
    this.parts.push("$0");
    return this;
  }

  /** Return the assembled snippet string. */
  build(): string {
    return this.parts.join("");
  }
}
