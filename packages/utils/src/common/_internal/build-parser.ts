import type { NonNullish } from '../types.js';

export function buildNullBasedParser<In extends unknown[], Out extends NonNullish>(
  parseValue: (...value: In) => Out | null,
  buildError: (...value: In) => string,
): Parser<In, Out> {
  const parse: Parser<In, Out> = (...value: In): Out | null => {
    return parseValue(...value);
  };

  parse.orThrow = (...value: In): Out => {
    const out = parseValue(...value);
    if (out === null) {
      throw new ParseError(buildError(...value));
    }

    return out;
  };

  return parse;
}

export function buildThrowBasedParser<In extends unknown[], Out extends NonNullish>(
  parseValue: (...value: In) => Out,
): Parser<In, Out> {
  const parse: Parser<In, Out> = (...value: In): Out | null => {
    try {
      return parseValue(...value);
    } catch (error) {
      if (error instanceof ParseError) {
        return null;
      }

      throw error;
    }
  };

  parse.orThrow = (...value: In): Out => {
    return parseValue(...value);
  };

  return parse;
}

export interface Parser<In extends unknown[], Out> {
  (...value: In): Out | null;

  orThrow(...value: In): Out;
}

export class ParseError extends Error {}
