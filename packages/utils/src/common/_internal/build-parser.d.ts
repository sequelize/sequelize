import type { NonNullish } from '../types.js';
export declare function buildNullBasedParser<In extends unknown[], Out extends NonNullish>(parseValue: (...value: In) => Out | null, buildError: (...value: In) => string): Parser<In, Out>;
export declare function buildThrowBasedParser<In extends unknown[], Out extends NonNullish>(parseValue: (...value: In) => Out): Parser<In, Out>;
export interface Parser<In extends unknown[], Out> {
    (...value: In): Out | null;
    orThrow(...value: In): Out;
}
export declare class ParseError extends Error {
}
