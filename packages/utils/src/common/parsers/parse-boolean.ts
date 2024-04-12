import { buildNullBasedParser } from '../_internal/build-parser.js';
import { inspect } from '../inspect.js';

export const parseBoolean = buildNullBasedParser(
  (value: string): boolean | null => {
    value = value.toLowerCase();

    switch (value) {
      case 'true':
        return true;
      case 'false':
        return false;
      default:
        return null;
    }
  },
  value => `Cannot convert ${inspect(value)} to a boolean. It must be either "true" or "false".`,
);
