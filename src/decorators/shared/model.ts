import type { ModelAttributeColumnOptions, ModelAttributes, ModelOptions, ModelStatic } from '../../model.js';
import type { Sequelize } from '../../sequelize.js';

interface RegisteredOptions {
  model: ModelOptions;
  attributes: { [key: string]: Partial<ModelAttributeColumnOptions> };
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
export function registerModelOptions(
  model: ModelStatic,
  options: ModelOptions,
): void {
  if (!registeredOptions.has(model)) {
    registeredOptions.set(model, { model: options, attributes: {} });

    return;
  }

  // merge-able: scopes, indexes, setterMethods, getterMethods
  const existingModelOptions = registeredOptions.get(model)!.model;

  for (const [optionName, optionValue] of Object.entries(options)) {
    if (!(optionName in existingModelOptions)) {
      // @ts-expect-error -- runtime type checking is enforced by model
      existingModelOptions[optionName] = optionValue;
      continue;
    }

    // These are objects. We merge their properties, unless the same key is used in both values.
    if (optionName === 'scopes' || optionName === 'setterMethods' || optionName === 'getterMethods') {
      for (const [subOptionName, subOptionValue] of Object.entries(optionValue)) {
        if (subOptionName in existingModelOptions[optionName]!) {
          throw new Error(`Multiple decorators are attempting to register option ${optionName}[${JSON.stringify(subOptionName)}] on model ${model.name}.`);
        }

        // @ts-expect-error -- runtime type checking is enforced by model
        existingModelOptions[optionName][subOptionName] = subOptionValue;
      }

      continue;
    }

    // This is an array. Simple array merge.
    if (optionName === 'indexes') {
      existingModelOptions.indexes = [...existingModelOptions.indexes!, ...optionValue];

      continue;
    }

    // @ts-expect-error
    if (optionValue === existingModelOptions[optionName]) {
      continue;
    }

    throw new Error(`Multiple decorators are attempting to set different values for the option ${optionName} on model ${model.name}.`);
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
  options: Partial<ModelAttributeColumnOptions>,
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

  const existingOptions = existingAttributesOptions[attributeName]!;

  for (const [optionName, optionValue] of Object.entries(options)) {
    if (!(optionName in existingOptions)) {
      // @ts-expect-error -- runtime type checking is enforced by model
      existingOptions[optionName] = optionValue;
      continue;
    }

    // These are objects. We merge their properties, unless the same key is used in both values.
    if (optionName === 'validate') {
      // @ts-expect-error
      for (const [subOptionName, subOptionValue] of Object.entries(optionValue)) {
        if (subOptionName in existingOptions[optionName]!) {
          throw new Error(`Multiple decorators are attempting to register option ${optionName}[${JSON.stringify(subOptionName)}] of attribute ${attributeName} on model ${model.name}.`);
        }

        // @ts-expect-error -- runtime type checking is enforced by model
        existingOptions[optionName][subOptionName] = subOptionValue;
      }

      continue;
    }

    // @ts-expect-error
    if (optionValue === existingOptions[optionName]) {
      continue;
    }

    throw new Error(`Multiple decorators are attempting to set different values for the option ${optionName} of attribute ${attributeName} on model ${model.name}.`);
  }
}

export function initDecoratedModel(model: ModelStatic, sequelize: Sequelize): void {
  const { model: modelOptions, attributes: attributeOptions } = registeredOptions.get(model) ?? {};

  // model.init will ensure all required attributeOptions have been specified.
  // @ts-expect-error secret method
  model._internalInit(attributeOptions as ModelAttributes, {
    ...modelOptions,
    sequelize,
  });
}

export function isDecoratedModel(model: ModelStatic): boolean {
  return registeredOptions.has(model);
}
