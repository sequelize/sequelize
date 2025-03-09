export function buildAssertionFunction<AssertedType>(
  isAssertedType: (value: unknown) => value is AssertedType,
  buildError: (value: unknown, shouldEqual: boolean) => string,
): [is: AssertionFunction<AssertedType>, isNot: NegatedAssertionFunction<AssertedType>] {
  const isType = (value: unknown): value is AssertedType => {
    return isAssertedType(value);
  };

  const isNotType = <Value>(value: Value): value is Exclude<Value, AssertedType> => {
    return !isAssertedType(value);
  };

  isType.assert = (value: unknown, message?: string): asserts value is AssertedType => {
    if (!isType(value)) {
      throw new Error(message ?? buildError(value, true));
    }
  };

  const assertIsNotType = <Value>(
    value: Value,
    message?: string,
  ): asserts value is Exclude<Value, AssertedType> => {
    if (isType(value)) {
      throw new Error(message ?? buildError(value, false));
    }
  };

  isNotType.assert = assertIsNotType;

  return [isType, isNotType];
}

export type AssertionTuple<AssertedType> = [
  is: AssertionFunction<AssertedType>,
  isNot: NegatedAssertionFunction<AssertedType>,
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

export function toBe(validValueOrType: string) {
  return function buildToBeErrorMessage(value: unknown, shouldEqual: boolean): string {
    return buildErrorMessage(validValueOrType, value, shouldEqual);
  };
}

export function buildErrorMessage(
  validValueOrType: string,
  value: unknown,
  shouldEqual: boolean,
): string {
  return `expected value ${shouldEqual ? '' : 'not '}to be ${validValueOrType} but got ${JSON.stringify(
    value,
  )} instead`;
}
