import { EMPTY_OBJECT } from '@sequelize/utils';
import { cloneDataType } from '../../abstract-dialect/data-types-utils.js';
import { BaseError } from '../../errors/base-error.js';
import { mergeModelOptions } from '../../model-definition.js';
import { initModel } from '../../model-typescript.js';
import type { AttributeOptions, ModelAttributes, ModelOptions, ModelStatic } from '../../model.js';
import type { Sequelize } from '../../sequelize.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { cloneDeep, getAllOwnEntries } from '../../utils/object.js';
import type { InheritedAttributeOptions } from '../legacy/attribute.js';

export interface RegisteredModelOptions extends ModelOptions {
  /**
   * Abstract models cannot be used directly, or registered.
   * They exist only to be extended by other models.
   */
  abstract?: boolean;
}

export interface RegisteredAttributeOptions {
  [key: string]: InheritedAttributeOptions;
}

interface RegisteredOptions {
  model: RegisteredModelOptions;
  attributes: RegisteredAttributeOptions;
}

const registeredOptions = new WeakMap<ModelStatic, RegisteredOptions>();

/**
 * Registers model options for future registering of the Model using Model.init
 * Subsequent calls for the same model & attributeName will be merged, with the newer call taking precedence.
 * 'sequelize' option is not accepted here. Pass it through `Model.init` when registering the model.
 *
 * @param model
 * @param options
 */
export function registerModelOptions(model: ModelStatic, options: RegisteredModelOptions): void {
  if (!registeredOptions.has(model)) {
    registeredOptions.set(model, { model: options, attributes: {} });

    return;
  }

  // merge-able: scopes, indexes
  const existingModelOptions = registeredOptions.get(model)!.model;

  try {
    mergeModelOptions(existingModelOptions, options, false);
  } catch (error) {
    throw new BaseError(
      `Multiple decorators are trying to register conflicting options on model ${model.name}`,
      { cause: error },
    );
  }
}

/**
 * Registers attribute options for future registering of the Model using Model.init
 * Subsequent calls for the same model & attributeName will be merged, with the newer call taking precedence.
 *
 * @param model
 * @param attributeName
 * @param options
 */
export function registerModelAttributeOptions(
  model: ModelStatic,
  attributeName: string,
  options: Partial<AttributeOptions>,
): void {
  if (!registeredOptions.has(model)) {
    registeredOptions.set(model, {
      model: {},
      attributes: {
        [attributeName]: options,
      },
    });

    return;
  }

  const existingAttributesOptions = registeredOptions.get(model)!.attributes;
  if (!(attributeName in existingAttributesOptions)) {
    existingAttributesOptions[attributeName] = options;

    return;
  }

  const existingOptions = existingAttributesOptions[attributeName];

  mergeAttributeOptions(attributeName, model, existingOptions, options, false);
}

export function mergeAttributeOptions(
  attributeName: string,
  model: ModelStatic,
  existingOptions: Partial<AttributeOptions>,
  options: Partial<AttributeOptions>,
  overrideOnConflict: boolean,
): Partial<AttributeOptions> {
  for (const [optionName, optionValue] of Object.entries(options) as Array<
    [keyof AttributeOptions, any]
  >) {
    if (existingOptions[optionName] === undefined) {
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- This error only occurs on TS 5.3+
      // @ts-ignore -- this function is very fuzzy in terms of typing due to how generic it is.
      existingOptions[optionName] = optionValue;
      continue;
    }

    // These are objects. We merge their properties, unless the same key is used in both values.
    if (optionName === 'validate') {
      for (const [subOptionName, subOptionValue] of getAllOwnEntries(optionValue)) {
        if (subOptionName in existingOptions[optionName] && !overrideOnConflict) {
          throw new Error(
            `Multiple decorators are attempting to register option ${optionName}[${JSON.stringify(subOptionName)}] of attribute ${attributeName} on model ${model.name}.`,
          );
        }

        // @ts-expect-error -- runtime type checking is enforced by model
        existingOptions[optionName][subOptionName] = subOptionValue;
      }

      continue;
    }

    if (optionName === 'index' || optionName === 'unique') {
      if (!existingOptions[optionName]) {
        existingOptions[optionName] = [];
      } else if (!Array.isArray(existingOptions[optionName])) {
        // @ts-expect-error -- runtime type checking is enforced by model
        existingOptions[optionName] = [existingOptions[optionName]];
      }

      if (Array.isArray(optionValue)) {
        // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- became valid in TS 5.8
        // @ts-ignore -- runtime type checking is enforced by model
        existingOptions[optionName] = [...existingOptions[optionName], ...optionValue];
      } else {
        existingOptions[optionName] = [...existingOptions[optionName], optionValue];
      }

      continue;
    }

    if (optionValue === existingOptions[optionName] || overrideOnConflict) {
      continue;
    }

    throw new Error(
      `Multiple decorators are attempting to set different values for the option ${optionName} of attribute ${attributeName} on model ${model.name}.`,
    );
  }

  return existingOptions;
}

export function initDecoratedModel(model: ModelStatic, sequelize: Sequelize): boolean {
  const isAbstract = registeredOptions.get(model)?.model.abstract;

  if (isAbstract) {
    return false;
  }

  const modelOptions = getRegisteredModelOptions(model);
  const attributeOptions = getRegisteredAttributeOptions(model);

  initModel(model, attributeOptions as ModelAttributes, {
    ...modelOptions,
    sequelize,
  });

  return true;
}

const NON_INHERITABLE_MODEL_OPTIONS = ['modelName', 'name', 'tableName'] as const;

function getRegisteredModelOptions(model: ModelStatic): ModelOptions {
  const modelOptions = registeredOptions.get(model)?.model ?? (EMPTY_OBJECT as ModelOptions);

  const parentModel = Object.getPrototypeOf(model);
  if (isModelStatic(parentModel)) {
    const parentModelOptions: ModelOptions = { ...getRegisteredModelOptions(parentModel) };

    for (const nonInheritableOption of NON_INHERITABLE_MODEL_OPTIONS) {
      delete parentModelOptions[nonInheritableOption];
    }

    // options that must be cloned
    parentModelOptions.indexes = cloneDeep(parentModelOptions.indexes);
    parentModelOptions.defaultScope = cloneDeep(parentModelOptions.defaultScope);
    parentModelOptions.scopes = cloneDeep(parentModelOptions.scopes);
    parentModelOptions.validate = cloneDeep(parentModelOptions.validate);
    parentModelOptions.hooks = cloneDeep(parentModelOptions.hooks);

    return mergeModelOptions(parentModelOptions, modelOptions, true);
  }

  return modelOptions;
}

function getRegisteredAttributeOptions(model: ModelStatic): RegisteredAttributeOptions {
  const descendantAttributes: RegisteredAttributeOptions = {
    ...(registeredOptions.get(model)?.attributes ?? EMPTY_OBJECT),
  };
  const insertAfterAttributes: RegisteredAttributeOptions = {};
  const insertBeforeAttributes: RegisteredAttributeOptions = {};

  const parentModel = Object.getPrototypeOf(model);
  if (isModelStatic(parentModel)) {
    const parentAttributes: RegisteredAttributeOptions = getRegisteredAttributeOptions(parentModel);

    for (const attributeName of Object.keys(parentAttributes)) {
      const parentAttribute = { ...parentAttributes[attributeName] };
      if (parentAttribute.insertBefore && parentAttribute.insertAfter) {
        throw new Error(
          `Attribute ${attributeName} on model ${model.name} cannot have both 'insertBefore' and 'insertAfter' set to true.`,
        );
      }

      if (parentAttribute.type) {
        if (typeof parentAttribute.type === 'function') {
          parentAttribute.type = new parentAttribute.type();
        } else {
          parentAttribute.type = cloneDataType(parentAttribute.type);
        }
      }

      // options that must be cloned
      parentAttribute.unique = cloneDeep(parentAttribute.unique);
      parentAttribute.index = cloneDeep(parentAttribute.index);
      parentAttribute.references = cloneDeep(parentAttribute.references);
      parentAttribute.validate = cloneDeep(parentAttribute.validate);

      const descendantAttribute = descendantAttributes[attributeName];
      if (descendantAttribute) {
        descendantAttributes[attributeName] = mergeAttributeOptions(
          attributeName,
          model,
          parentAttribute,
          descendantAttribute,
          true,
        );
      } else if (parentAttribute.insertBefore) {
        insertBeforeAttributes[attributeName] = parentAttribute;
      } else {
        insertAfterAttributes[attributeName] = parentAttribute;
      }
    }
  }

  return {
    ...insertBeforeAttributes,
    ...descendantAttributes,
    ...insertAfterAttributes,
  };
}

export function isDecoratedModel(model: ModelStatic): boolean {
  return registeredOptions.has(model);
}
