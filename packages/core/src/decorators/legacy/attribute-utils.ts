import type { AttributeOptions, ModelStatic } from '../../model.js';
import { Model } from '../../model.js';
import { registerModelAttributeOptions } from '../shared/model.js';
import type {
  OptionalParameterizedPropertyDecorator,
  RequiredParameterizedPropertyDecorator,
} from './decorator-utils.js';
import {
  DECORATOR_NO_DEFAULT,
  createOptionallyParameterizedPropertyDecorator,
  throwMustBeAttribute,
  throwMustBeInstanceProperty,
  throwMustBeModel,
} from './decorator-utils.js';

/**
 * Creates a decorator that registers Attribute Options. Parameters are mandatory.
 *
 * @param decoratorName The name of the decorator (must be equal to its export key)
 * @param callback The callback that will return the Attribute Options.
 */
export function createRequiredAttributeOptionsDecorator<T>(
  decoratorName: string,
  callback: (
    option: T,
    target: Object,
    propertyName: string | symbol,
    propertyDescriptor: PropertyDescriptor | undefined,
  ) => Partial<AttributeOptions>,
): RequiredParameterizedPropertyDecorator<T> {
  return createOptionalAttributeOptionsDecorator(decoratorName, DECORATOR_NO_DEFAULT, callback);
}

/**
 * Creates a decorator that registers Attribute Options. Parameters are optional.
 *
 * @param decoratorName The name of the decorator (must be equal to its export key)
 * @param defaultValue The default value, if no parameter was provided.
 * @param callback The callback that will return the Attribute Options.
 */
export function createOptionalAttributeOptionsDecorator<T>(
  decoratorName: string,
  defaultValue: T | typeof DECORATOR_NO_DEFAULT,
  callback: (
    option: T,
    target: Object,
    propertyName: string,
    propertyDescriptor: PropertyDescriptor | undefined,
  ) => Partial<AttributeOptions>,
): OptionalParameterizedPropertyDecorator<T> {
  return createOptionallyParameterizedPropertyDecorator(
    decoratorName,
    defaultValue,
    (decoratorOption, target, propertyName, propertyDescriptor) => {
      if (typeof propertyName === 'symbol') {
        throwMustBeAttribute(decoratorName, target, propertyName);
      }

      const attributeOptions = callback(decoratorOption, target, propertyName, propertyDescriptor);

      annotate(decoratorName, target, propertyName, propertyDescriptor, attributeOptions);
    },
  );
}

function annotate(
  decoratorName: string,
  target: Object,
  propertyName: string,
  propertyDescriptor: PropertyDescriptor | undefined,
  options: Partial<AttributeOptions>,
): void {
  if (typeof target === 'function') {
    throwMustBeInstanceProperty(decoratorName, target, propertyName);
  }

  if (!(target instanceof Model)) {
    throwMustBeModel(decoratorName, target, propertyName);
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
