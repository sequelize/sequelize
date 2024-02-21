export type PropertyOrGetterDescriptor = (
  target: Object,
  propertyName: string | symbol,
  propertyDescriptor?: PropertyDescriptor,
) => void;

export interface OptionalParameterizedPropertyDecorator<T> {
  // @Decorator()
  (): PropertyOrGetterDescriptor;
  // @Decorator(value)
  (options: T): PropertyOrGetterDescriptor;
  // @Decorator
  (target: Object, propertyName: string | symbol, propertyDescriptor?: PropertyDescriptor): void;
}

export interface RequiredParameterizedPropertyDecorator<T> {
  // @Decorator(value)
  (options: T): PropertyOrGetterDescriptor;
}

export const DECORATOR_NO_DEFAULT = Symbol('DECORATOR_NO_DEFAULT');

/**
 * Creates a decorator that MUST receive a parameter
 *
 * @param name
 * @param callback The callback that will be executed once the decorator is applied.
 */
export function createParameterizedPropertyDecorator<T>(
  name: string,
  callback: (
    option: T,
    target: Object,
    propertyName: string | symbol,
    propertyDescriptor: PropertyDescriptor | undefined,
  ) => void,
): RequiredParameterizedPropertyDecorator<T> {
  return createOptionallyParameterizedPropertyDecorator(name, DECORATOR_NO_DEFAULT, callback);
}

/**
 * Creates a decorator that can optionally receive a parameter
 *
 * @param name
 * @param defaultValue The value to use if no parameter is provided.
 * @param callback The callback that will be executed once the decorator is applied.
 */
export function createOptionallyParameterizedPropertyDecorator<T>(
  name: string,
  defaultValue: T | typeof DECORATOR_NO_DEFAULT,
  callback: (
    option: T,
    target: Object,
    propertyName: string | symbol,
    propertyDescriptor: PropertyDescriptor | undefined,
  ) => void,
): OptionalParameterizedPropertyDecorator<T> {
  return function decorator(...args: [] | [options: T] | Parameters<PropertyOrGetterDescriptor>) {
    // note: cannot use <= 1, because TypeScript uses this to infer the type of "args".
    if (args.length === 0 || args.length === 1) {
      return function parameterizedDecorator(
        target: Object,
        propertyName: string | symbol,
        propertyDescriptor?: PropertyDescriptor | undefined,
      ) {
        const value = args[0] ?? defaultValue;
        if (value === DECORATOR_NO_DEFAULT) {
          throw new Error(
            `Decorator @${name} requires an argument (used on ${getPropertyName(target, propertyName)})`,
          );
        }

        callback(
          value,
          target,
          propertyName,
          propertyDescriptor ?? Object.getOwnPropertyDescriptor(target, propertyName),
        );
      };
    }

    if (defaultValue === DECORATOR_NO_DEFAULT) {
      throw new Error(
        `Decorator @${name} requires an argument (used on ${getPropertyName(args[0], args[1])})`,
      );
    }

    callback(
      defaultValue,
      args[0],
      args[1],
      args[2] ?? Object.getOwnPropertyDescriptor(args[0], args[1]),
    );

    // this method only returns something if args.length === 1, but typescript doesn't understand it
    return undefined as unknown as PropertyOrGetterDescriptor;
  };
}

export function throwMustBeStaticProperty(
  decoratorName: string,
  target: Object,
  propertyName: string | symbol,
): never {
  throw new TypeError(
    `Decorator @${decoratorName} has been used on ${getPropertyName(target, propertyName)}, which is an instance property. This decorator can only be used on static properties, setters and getters.`,
  );
}

export function throwMustBeModel(
  decoratorName: string,
  target: Object,
  propertyName: string | symbol,
): never {
  throw new TypeError(
    `Decorator @${decoratorName} has been used on ${getPropertyName(target, propertyName)}, but class "${getClassName(target)}" does not extend Model. This decorator can only be used on models.`,
  );
}

export function throwMustBeInstanceProperty(
  decoratorName: string,
  target: Object,
  propertyName: string | symbol,
): never {
  throw new TypeError(
    `Decorator @${decoratorName} has been used on ${getPropertyName(target, propertyName)}, which is static. This decorator can only be used on instance properties, setters and getters.`,
  );
}

export function throwMustBeMethod(
  decoratorName: string,
  target: Object,
  propertyName: string | symbol,
): never {
  throw new TypeError(
    `Decorator @${decoratorName} has been used on ${getPropertyName(target, propertyName)}, which is not a method. This decorator can only be used on methods.`,
  );
}

export function throwMustBeAttribute(
  decoratorName: string,
  target: Object,
  propertyName: string | symbol,
): never {
  throw new TypeError(
    `Decorator @${decoratorName} has been used on ${getPropertyName(target, propertyName)}, which is a symbol field. Symbol Model Attributes are not currently supported. We welcome a PR that implements this feature.`,
  );
}

export function getPropertyName(obj: object, property: string | symbol): string {
  if (typeof obj === 'function') {
    return `${obj.name}.${String(property)}`;
  }

  return `${obj.constructor.name}#${String(property)}`;
}

export function getClassName(obj: object): string {
  if (typeof obj === 'function') {
    return obj.name;
  }

  return obj.constructor.name;
}
