import type { ModelStatic } from '../../model.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { registerModelOptions } from '../shared/model.js';
import type { OptionalParameterizedPropertyDecorator } from './decorator-utils.js';
import {
  createOptionallyParameterizedPropertyDecorator,
  throwMustBeAttribute,
  throwMustBeInstanceProperty,
  throwMustBeModel,
} from './decorator-utils.js';

function createBuiltInAttributeDecorator(
  decoratorName: string,
  callback: (target: ModelStatic, propertyName: string) => void,
): OptionalParameterizedPropertyDecorator<undefined> {
  return createOptionallyParameterizedPropertyDecorator<undefined>(
    decoratorName,
    undefined,
    (decoratorOption, target, propertyName) => {
      if (typeof target === 'function') {
        throwMustBeInstanceProperty(decoratorName, target, propertyName);
      }

      if (!isModelStatic(target.constructor)) {
        throwMustBeModel(decoratorName, target, propertyName);
      }

      if (typeof propertyName === 'symbol') {
        throwMustBeAttribute(decoratorName, target, propertyName);
      }

      callback(target.constructor, propertyName);
    },
  );
}

export const CreatedAt = createBuiltInAttributeDecorator(
  'CreatedAt',
  (target: ModelStatic, propertyName: string) => {
    registerModelOptions(target, {
      createdAt: propertyName,
      timestamps: true,
    });
  },
);

export const UpdatedAt = createBuiltInAttributeDecorator(
  'UpdatedAt',
  (target: ModelStatic, propertyName: string) => {
    registerModelOptions(target, {
      updatedAt: propertyName,
      timestamps: true,
    });
  },
);

export const DeletedAt = createBuiltInAttributeDecorator(
  'DeletedAt',
  (target: ModelStatic, propertyName: string) => {
    registerModelOptions(target, {
      deletedAt: propertyName,
      timestamps: true,
      paranoid: true,
    });
  },
);

export const Version = createBuiltInAttributeDecorator(
  'Version',
  (target: ModelStatic, propertyName: string) => {
    registerModelOptions(target, {
      version: propertyName,
    });
  },
);
