export type PropertyOrGetterDescriptor = (
  target: Object,
  propertyName: string | symbol,
  propertyDescriptor?: PropertyDescriptor,
) => void;

export interface ParameterizedPropertyDecorator<T> {
  (options: T): PropertyOrGetterDescriptor;

  (target: Object, propertyName: string | symbol, propertyDescriptor?: PropertyDescriptor): void;
}

export function makeParameterizedPropertyDecorator<T>(
  defaultValue: T,
  callback: (
    option: T,
    target: Object,
    propertyName: string | symbol,
    propertyDescriptor: PropertyDescriptor | undefined,
  ) => void,
): ParameterizedPropertyDecorator<T> {
  return function decorator(...args: [options: T] | Parameters<PropertyOrGetterDescriptor>) {
    if (args.length === 1) {
      return function parameterizedDecorator(
        target: Object,
        propertyName: string | symbol,
        propertyDescriptor?: PropertyDescriptor | undefined,
      ) {
        callback(args[0], target, propertyName, propertyDescriptor ?? Object.getOwnPropertyDescriptor(target, propertyName));
      };
    }

    callback(defaultValue, args[0], args[1], args[2] ?? Object.getOwnPropertyDescriptor(args[0], args[1]));

    // this method only returns something if args.length === 1, but typescript doesn't understand it
    return undefined as unknown as PropertyOrGetterDescriptor;
  };
}
