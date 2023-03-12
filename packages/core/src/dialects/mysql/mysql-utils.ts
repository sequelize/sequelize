export function escapeMysqlString(value: string): string {
  // eslint-disable-next-line no-control-regex -- \u001A is intended to be in this regex
  value = value.replace(/[\b\0\t\n\r\u001A'\\]/g, s => {
    switch (s) {
      case '\0': return '\\0';
      case '\n': return '\\n';
      case '\r': return '\\r';
      case '\b': return '\\b';
      case '\t': return '\\t';
      case '\u001A': return '\\Z';
      default: return `\\${s}`;
    }
  });

  return `'${value}'`;
}
