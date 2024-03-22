export declare function buildAssertionFunction<AssertedType>(isAssertedType: (value: unknown) => value is AssertedType, buildError: (value: unknown, shouldEqual: boolean) => string): [is: AssertionFunction<AssertedType>, isNot: NegatedAssertionFunction<AssertedType>];
export type AssertionTuple<AssertedType> = [
    is: AssertionFunction<AssertedType>,
    isNot: NegatedAssertionFunction<AssertedType>
];
export interface AssertionFunction<AssertedType> {
    assert(value: unknown, message?: string): asserts value is AssertedType;
    (value: unknown): value is AssertedType;
}
export interface NegatedAssertionFunction<AssertedType> {
    assert<Value>(value: Value, message?: string): asserts value is Exclude<Value, AssertedType>;
    /**
     * For use as a predicate callback. Prefer using `!` instead if you are not using it as a predicate.
     *
     * @example
     * // exclude all strings
     * [].filter(isNotString)
     */
    <Value>(value: Value): value is Exclude<Value, AssertedType>;
}
export declare function toBe(validValueOrType: string): (value: unknown, shouldEqual: boolean) => string;
export declare function buildErrorMessage(validValueOrType: string, value: unknown, shouldEqual: boolean): string;
