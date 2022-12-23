import upperFirst from 'lodash/upperFirst';
import type { ColumnValidateOptions, ModelOptions } from '../../model.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { registerModelOptions } from '../shared/model.js';
import { createOptionalAttributeOptionsDecorator, createRequiredAttributeOptionsDecorator } from './attribute-utils.js';
import type { OptionalParameterizedPropertyDecorator, RequiredParameterizedPropertyDecorator } from './decorator-utils.js';
import {
  createOptionallyParameterizedPropertyDecorator,
  throwMustBeMethod,
  throwMustBeModel,
} from './decorator-utils.js';

type ValidateKeys = Extract<keyof ColumnValidateOptions, string>;

function createRequiredAttributeValidationDecorator<Key extends ValidateKeys>(
  decoratorName: Key,
): RequiredParameterizedPropertyDecorator<ColumnValidateOptions[Key]> {
  return createRequiredAttributeOptionsDecorator<ColumnValidateOptions[Key]>(
    upperFirst(decoratorName),
    (decoratorOption: ColumnValidateOptions[Key]) => {
      return { validate: { [decoratorName]: decoratorOption } };
    },
  );
}

function createOptionalAttributeValidationDecorator<Key extends ValidateKeys>(
  decoratorName: Key,
  defaultValue: ColumnValidateOptions[Key],
): OptionalParameterizedPropertyDecorator<ColumnValidateOptions[Key]> {
  return createOptionalAttributeOptionsDecorator<ColumnValidateOptions[Key]>(
    upperFirst(decoratorName),
    defaultValue,
    (decoratorOption: ColumnValidateOptions[Key]) => {
      return { validate: { [decoratorName]: decoratorOption } };
    },
  );
}

/**
 * Used to register a function that will be called when an attribute is being validated.
 *
 * @example
 * ```ts
 * class User extends Model {
 *   @Attribute(DataTypes.STRING)
 *   @ValidateAttribute({
 *     myCustomValidator: () => {
 *       // this function will run when this attribute is validated.
 *     },
 *   })
 *   declare name: string;
 * }
 * ```
 *
 * See also {@link ModelValidator}.
 */
export const ValidateAttribute = createRequiredAttributeOptionsDecorator<ColumnValidateOptions>(
  'ValidateAttribute',
  (decoratorOption: ColumnValidateOptions) => {
    return { validate: decoratorOption };
  },
);

/**
 * Used to register a model method that will be called when an instance is being validated.
 * Available as both an instance and static method (static method receives the model as a parameter).
 *
 * @example
 * ```ts
 * class User extends Model {
 *   @ValidateModel
 *   onValidate() {
 *     if (this.name !== VALID_NAME) {
 *       throw new Error(ERROR_MESSAGE);
 *     }
 *   }
 *
 *   @ValidateModel
 *   static onValidate(instance) {
 *     if (instance.name !== VALID_NAME) {
 *       throw new Error(ERROR_MESSAGE);
 *     }
 *   }
 * }
 * ```
 *
 * See also {@link ValidateAttribute}.
 */
export const ModelValidator = createOptionallyParameterizedPropertyDecorator<undefined>(
  'ModelValidator',
  undefined,
  (decoratorOption: ModelOptions['validate'], target: Object, propertyName: string | symbol) => {
    const isStatic = typeof target === 'function';
    const targetClass = isStatic ? target : target.constructor;

    if (!isModelStatic(targetClass)) {
      throwMustBeModel('ValidateModel', target, propertyName);
    }

    // @ts-expect-error -- it's normal to get any here
    const property = target[propertyName];
    if (typeof property !== 'function') {
      throwMustBeMethod('ValidateModel', target, propertyName);
    }

    const validator = isStatic ? function validate() {
      // When registered as a static method, the model is passed as the first parameter, and the context ("this") must be the class
      /* eslint-disable @typescript-eslint/no-invalid-this */
      // @ts-expect-error -- description above ^
      property.call(target, this);
      /* eslint-enable @typescript-eslint/no-invalid-this */
    } : property;

    registerModelOptions(targetClass, {
      validate: {
        [propertyName]: validator,
      },
    });
  },
);

export const Is = createRequiredAttributeValidationDecorator('is');

export const Not = createRequiredAttributeValidationDecorator('not');

export const IsEmail = createOptionalAttributeValidationDecorator('isEmail', true);

export const IsUrl = createOptionalAttributeValidationDecorator('isUrl', true);

export const IsIP = createOptionalAttributeValidationDecorator('isIP', true);

export const IsIPv4 = createOptionalAttributeValidationDecorator('isIPv4', true);

export const IsIPv6 = createOptionalAttributeValidationDecorator('isIPv6', true);

export const IsAlpha = createOptionalAttributeValidationDecorator('isAlpha', true);

export const IsAlphanumeric = createOptionalAttributeValidationDecorator('isAlphanumeric', true);

export const IsNumeric = createOptionalAttributeValidationDecorator('isNumeric', true);

export const IsInt = createOptionalAttributeValidationDecorator('isInt', true);

export const IsFloat = createOptionalAttributeValidationDecorator('isFloat', true);

export const IsDecimal = createOptionalAttributeValidationDecorator('isDecimal', true);

export const IsLowercase = createOptionalAttributeValidationDecorator('isLowercase', true);

export const IsUppercase = createOptionalAttributeValidationDecorator('isUppercase', true);

export const NotEmpty = createOptionalAttributeValidationDecorator('notEmpty', true);

export const Equals = createRequiredAttributeValidationDecorator('equals');

export const Contains = createRequiredAttributeValidationDecorator('contains');

export const NotIn = createRequiredAttributeValidationDecorator('notIn');

export const IsIn = createRequiredAttributeValidationDecorator('isIn');

export const NotContains = createRequiredAttributeValidationDecorator('notContains');

export const Len = createRequiredAttributeValidationDecorator('len');

export const IsUUID = createRequiredAttributeValidationDecorator('isUUID');

export const IsDate = createOptionalAttributeValidationDecorator('isDate', true);

export const IsAfter = createRequiredAttributeValidationDecorator('isAfter');

export const IsBefore = createRequiredAttributeValidationDecorator('isBefore');

export const Max = createRequiredAttributeValidationDecorator('max');

export const Min = createRequiredAttributeValidationDecorator('min');

export const IsArray = createOptionalAttributeValidationDecorator('isArray', true);

export const IsCreditCard = createOptionalAttributeValidationDecorator('isCreditCard', true);
