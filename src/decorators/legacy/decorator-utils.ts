import type { ModelAttributeColumnOptions, ModelStatic } from '../../model.js';
import { Model } from '../../model.js';
import { registerModelAttributeOptions } from '../shared/model.js';

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

const DECORATOR_NO_DEFAULT = Symbol('DECORATOR_NO_DEFAULT');

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
          throw new Error(`Decorator @${name} requires an argument (used on ${getPropertyName(target, propertyName)})`);
        }

        callback(value, target, propertyName, propertyDescriptor ?? Object.getOwnPropertyDescriptor(target, propertyName));
      };
    }

    if (defaultValue === DECORATOR_NO_DEFAULT) {
      throw new Error(`Decorator @${name} requires an argument (used on ${getPropertyName(args[0], args[1])})`);
    }

    callback(defaultValue, args[0], args[1], args[2] ?? Object.getOwnPropertyDescriptor(args[0], args[1]));

    // this method only returns something if args.length === 1, but typescript doesn't understand it
    return undefined as unknown as PropertyOrGetterDescriptor;
  };
}

export function createRequiredAttributeOptionsDecorator<T>(
  decoratorName: string,
  callback: (
    option: T,
    target: Object,
    propertyName: string | symbol,
    propertyDescriptor: PropertyDescriptor | undefined,
  ) => Partial<ModelAttributeColumnOptions>,
): RequiredParameterizedPropertyDecorator<T> {
  return createOptionalAttributeOptionsDecorator(decoratorName, DECORATOR_NO_DEFAULT, callback);
}

export function createOptionalAttributeOptionsDecorator<T>(
  decoratorName: string,
  defaultValue: T | typeof DECORATOR_NO_DEFAULT,
  callback: (
    option: T,
    target: Object,
    propertyName: string | symbol,
    propertyDescriptor: PropertyDescriptor | undefined,
  ) => Partial<ModelAttributeColumnOptions>,
): OptionalParameterizedPropertyDecorator<T> {
  return createOptionallyParameterizedPropertyDecorator(
    decoratorName,
    defaultValue,
    (decoratorOption, target, propertyName, propertyDescriptor) => {
      const attributeOptions = callback(decoratorOption, target, propertyName, propertyDescriptor);

      annotate(decoratorName, target, propertyName, propertyDescriptor, attributeOptions);
    },
  );
}

function annotate(
  decoratorName: string,
  target: Object,
  propertyName: string | symbol,
  propertyDescriptor: PropertyDescriptor | undefined,
  options: Partial<ModelAttributeColumnOptions>,
): void {
  if (typeof propertyName === 'symbol') {
    throw new TypeError('Symbol Model Attributes are not currently supported. We welcome a PR that implements this feature.');
  }

  if (typeof target === 'function') {
    throwMustBeInstanceProperty(decoratorName, target, propertyName);
  }

  if (!(target instanceof Model)) {
    throwMustBeMethod(decoratorName, target, propertyName);
  }

  options = { ...options };

  if (propertyDescriptor) {
    if (propertyDescriptor.get) {
      options.get = propertyDescriptor.get;
    }

    if (propertyDescriptor.set) {
      options.set = propertyDescriptor.set;
    }
  }

  registerModelAttributeOptions(target.constructor as ModelStatic, propertyName, options);
}

export function throwMustBeStaticProperty(decoratorName: string, target: Object, propertyName: string | symbol): never {
  throw new TypeError(
    `Decorator @${decoratorName} has been used on ${getPropertyName(target, propertyName)}, which is an instance property. This decorator can only be used on static properties, setters and getters.`,
  );
}

export function throwMustBeModel(decoratorName: string, target: Object, propertyName: string | symbol): never {
  throw new TypeError(
    `Decorator @${decoratorName} has been used on ${getPropertyName(target, propertyName)}, but class "${getClassName(target)}" does not extend Model. This decorator can only be used on models.`,
  );
}

export function throwMustBeInstanceProperty(decoratorName: string, target: Object, propertyName: string | symbol): never {
  throw new TypeError(
    `Decorator @${decoratorName} has been used on ${getPropertyName(target, propertyName)}, which is static. This decorator can only be used on instance properties, setters and getters.`,
  );
}

export function throwMustBeMethod(decoratorName: string, target: Object, propertyName: string | symbol): never {
  throw new TypeError(
    `Decorator @${decoratorName} has been used on ${getPropertyName(target, propertyName)}, which is not a method. This decorator can only be used on methods.`,
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
