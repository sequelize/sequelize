import { mergeModelOptions } from '../../model-definition.js';
import { initModel } from '../../model-typescript.js';
import type { AttributeOptions, ModelAttributes, ModelOptions, ModelStatic } from '../../model.js';
import type { Sequelize } from '../../sequelize.js';
import { getAllOwnEntries } from '../../utils/object.js';

interface RegisteredOptions {
  model: ModelOptions;
  attributes: { [key: string]: Partial<AttributeOptions> };
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

  // merge-able: scopes, indexes
  const existingModelOptions = registeredOptions.get(model)!.model;

  try {
    mergeModelOptions(existingModelOptions, options, false);
  } catch (error) {
    // TODO [TS 4.8]: remove this "as Error" cast once support for TS < 4.8 is dropped, as the typing of "cause" has been fixed in TS 4.8
    throw new Error(`Multiple decorators are trying to register conflicting options on model ${model.name}`, { cause: error as Error });
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

  const existingOptions = existingAttributesOptions[attributeName]!;

  for (const [optionName, optionValue] of Object.entries(options)) {
    if (!(optionName in existingOptions)) {
      // @ts-expect-error -- runtime type checking is enforced by model
      existingOptions[optionName] = optionValue;
      continue;
    }

    // These are objects. We merge their properties, unless the same key is used in both values.
    if (optionName === 'validate') {
      // @ts-expect-error -- dynamic type, not worth typing
      for (const [subOptionName, subOptionValue] of getAllOwnEntries(optionValue)) {
        if (subOptionName in existingOptions[optionName]!) {
          throw new Error(`Multiple decorators are attempting to register option ${optionName}[${JSON.stringify(subOptionName)}] of attribute ${attributeName} on model ${model.name}.`);
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
        // @ts-expect-error -- runtime type checking is enforced by model
        existingOptions[optionName] = [...existingOptions[optionName], ...optionValue];
      } else {
        existingOptions[optionName] = [...existingOptions[optionName], optionValue];
      }

      continue;
    }

    // @ts-expect-error -- dynamic type, not worth typing
    if (optionValue === existingOptions[optionName]) {
      continue;
    }

    throw new Error(`Multiple decorators are attempting to set different values for the option ${optionName} of attribute ${attributeName} on model ${model.name}.`);
  }
}

export function initDecoratedModel(model: ModelStatic, sequelize: Sequelize): void {
  const { model: modelOptions, attributes: attributeOptions = {} } = registeredOptions.get(model) ?? {};

  initModel(model, attributeOptions as ModelAttributes, {
    ...modelOptions,
    sequelize,
  });
}

export function isDecoratedModel(model: ModelStatic): boolean {
  return registeredOptions.has(model);
}
