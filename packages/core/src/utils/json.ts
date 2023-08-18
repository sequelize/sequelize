/**
 * Returns a JSON path identifier that is safe to use in a JSON path.
 *
 * @param identifier - The identifier to quote.
 */
function quoteJsonPathIdentifier(identifier: string): string {
  if (/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    return identifier;
  }

  // Escape backslashes and double quotes
  return `"${identifier.replaceAll(/["\\]/g, s => `\\${s}`)}"`;
}

/**
 * Builds a JSON path expression from a path.
 *
 * @param path - The path to build the expression from.
 */
export function buildJsonPath(path: ReadonlyArray<number | string>): string {
  let jsonPathStr = '$';
  for (const pathElement of path) {
    if (typeof pathElement === 'number') {
      jsonPathStr += `[${pathElement}]`;
    } else {
      jsonPathStr += `.${quoteJsonPathIdentifier(pathElement)}`;
    }
  }

  return jsonPathStr;
}
