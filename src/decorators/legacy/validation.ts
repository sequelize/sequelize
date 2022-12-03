import upperFirst from 'lodash/upperFirst';
import type { ColumnValidateOptions, ModelOptions } from '../../model.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { registerModelOptions } from '../shared/model.js';
import type { OptionalParameterizedPropertyDecorator, RequiredParameterizedPropertyDecorator } from './decorator-utils.js';
import {
  createOptionalAttributeOptionsDecorator,
  createOptionallyParameterizedPropertyDecorator,
  createRequiredAttributeOptionsDecorator,
  throwMustBeMethod,
  throwMustBeModel,
} from './decorator-utils.js';

type ValidateKeys = Extract<keyof ColumnValidateOptions, string>;

function createRequiredAttrValidateDecorator<Key extends ValidateKeys>(
  decoratorName: Key,
): RequiredParameterizedPropertyDecorator<ColumnValidateOptions[Key]> {
  return createRequiredAttributeOptionsDecorator<ColumnValidateOptions[Key]>(
    upperFirst(decoratorName),
    (decoratorOption: ColumnValidateOptions[Key]) => {
      return { validate: { [decoratorName]: decoratorOption } };
    },
  );
}

function createOptionalAttrValidateDecorator<Key extends ValidateKeys>(
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
 * See also {@link ValidateModel}.
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

export const Is = createRequiredAttrValidateDecorator('is');

export const Not = createRequiredAttrValidateDecorator('not');

export const IsEmail = createOptionalAttrValidateDecorator('isEmail', true);

export const IsUrl = createOptionalAttrValidateDecorator('isUrl', true);

export const IsIP = createOptionalAttrValidateDecorator('isIP', true);

export const IsIPv4 = createOptionalAttrValidateDecorator('isIPv4', true);

export const IsIPv6 = createOptionalAttrValidateDecorator('isIPv6', true);

export const IsAlpha = createOptionalAttrValidateDecorator('isAlpha', true);

export const IsAlphanumeric = createOptionalAttrValidateDecorator('isAlphanumeric', true);

export const IsNumeric = createOptionalAttrValidateDecorator('isNumeric', true);

export const IsInt = createOptionalAttrValidateDecorator('isInt', true);

export const IsFloat = createOptionalAttrValidateDecorator('isFloat', true);

export const IsDecimal = createOptionalAttrValidateDecorator('isDecimal', true);

export const IsLowercase = createOptionalAttrValidateDecorator('isLowercase', true);

export const IsUppercase = createOptionalAttrValidateDecorator('isUppercase', true);

export const NotEmpty = createOptionalAttrValidateDecorator('notEmpty', true);

export const Equals = createRequiredAttrValidateDecorator('equals');

export const Contains = createRequiredAttrValidateDecorator('contains');

export const NotIn = createRequiredAttrValidateDecorator('notIn');

export const IsIn = createRequiredAttrValidateDecorator('isIn');

export const NotContains = createRequiredAttrValidateDecorator('notContains');

export const Len = createRequiredAttrValidateDecorator('len');

export const IsUUID = createRequiredAttrValidateDecorator('isUUID');

export const IsDate = createOptionalAttrValidateDecorator('isDate', true);

export const IsAfter = createRequiredAttrValidateDecorator('isAfter');

export const IsBefore = createRequiredAttrValidateDecorator('isBefore');

export const Max = createRequiredAttrValidateDecorator('max');

export const Min = createRequiredAttrValidateDecorator('min');

export const IsArray = createOptionalAttrValidateDecorator('isArray', true);

export const IsCreditCard = createOptionalAttrValidateDecorator('isCreditCard', true);
