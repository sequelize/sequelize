export function parseDefaultValue(rawDefaultValue: string | null, columnType: string): unknown {
    if (rawDefaultValue === null || rawDefaultValue.startsWith('NULL::')) {
        return null;
    }

    if (['true', 'false'].includes(rawDefaultValue) && columnType === 'BOOLEAN') {
        return rawDefaultValue === 'true';
    }

    if (rawDefaultValue && !Number.isNaN(Number(rawDefaultValue))) {
        return Number(rawDefaultValue);
    }

    if (rawDefaultValue.endsWith('::numeric') || rawDefaultValue.endsWith('::integer')) {
        const unQuote = rawDefaultValue.replace(/^'/, '').replace(/'?::.*$/, '');

        return Number(unQuote);
    }

    if (rawDefaultValue.startsWith("'")) {
        return parseStringValue(rawDefaultValue);
    }

    return undefined;
}

function parseStringValue(rawDefaultValue: string): string | undefined {
    let buffer = '';

    for (let i = 1; i < rawDefaultValue.length; i += 1) {
      const char = rawDefaultValue[i];

      if (char === "'") {
        if (rawDefaultValue[i + 1] === "'") {
          i += 1;
        } else {
          return buffer;
        }
      }

      buffer += char;
    }

    // Unable to parse string, return undefined
    return undefined;
}