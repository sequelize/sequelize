import upperFirst from 'lodash/upperFirst';
import type { ColumnValidateOptions, ModelOptions } from '../../model.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { registerModelOptions } from '../shared/model.js';
import type { RequiredParameterizedPropertyDecorator } from './decorator-utils.js';
import {
  createOptionallyParameterizedPropertyDecorator,
  createRequiredAttributeOptionsDecorator,
  throwMustBeMethod,
  throwMustBeModel,
  throwMustBeStaticProperty,
} from './decorator-utils.js';

type ValidateKeys = Extract<keyof ColumnValidateOptions, string>;

function createAttrValidateDecorator<Key extends ValidateKeys>(
  decoratorName: Key,
): RequiredParameterizedPropertyDecorator<ColumnValidateOptions[Key]> {
  return createRequiredAttributeOptionsDecorator<ColumnValidateOptions[Key]>(
    upperFirst(decoratorName),
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
export const ValidateModel = createOptionallyParameterizedPropertyDecorator<undefined>(
  'ValidateModel',
  undefined,
  (decoratorOption: ModelOptions['validate'], target: Object, propertyName: string | symbol) => {
    if (typeof target !== 'function') {
      throwMustBeStaticProperty('ValidateModel', target, propertyName);
    }

    if (!isModelStatic(target)) {
      throwMustBeModel('ValidateModel', target, propertyName);
    }

    // @ts-expect-error -- it's normal to get any here
    const property = target[propertyName];
    if (typeof property !== 'function') {
      throwMustBeMethod('ValidateModel', target, propertyName);
    }

    const key = Symbol(`method ${String(propertyName)}`);

    registerModelOptions(target, {
      validate: {
        [key]: property.bind(target),
      },
    });
  },
);

export const Is = createAttrValidateDecorator('is');

export const Not = createAttrValidateDecorator('not');

export const IsEmail = createAttrValidateDecorator('isEmail');

export const IsUrl = createAttrValidateDecorator('isUrl');

export const IsIP = createAttrValidateDecorator('isIP');

export const IsIPv4 = createAttrValidateDecorator('isIPv4');

export const IsIPv6 = createAttrValidateDecorator('isIPv6');

export const IsAlpha = createAttrValidateDecorator('isAlpha');

export const IsAlphanumeric = createAttrValidateDecorator('isAlphanumeric');

export const IsNumeric = createAttrValidateDecorator('isNumeric');

export const IsInt = createAttrValidateDecorator('isInt');

export const IsFloat = createAttrValidateDecorator('isFloat');

export const IsDecimal = createAttrValidateDecorator('isDecimal');

export const IsLowercase = createAttrValidateDecorator('isLowercase');

export const IsUppercase = createAttrValidateDecorator('isUppercase');

export const NotEmpty = createAttrValidateDecorator('notEmpty');

export const Equals = createAttrValidateDecorator('equals');

export const Contains = createAttrValidateDecorator('contains');

export const NotIn = createAttrValidateDecorator('notIn');

export const IsIn = createAttrValidateDecorator('isIn');

export const NotContains = createAttrValidateDecorator('notContains');

export const Len = createAttrValidateDecorator('len');

export const IsUUID = createAttrValidateDecorator('isUUID');

export const IsDate = createAttrValidateDecorator('isDate');

export const IsAfter = createAttrValidateDecorator('isAfter');

export const IsBefore = createAttrValidateDecorator('isBefore');

export const Max = createAttrValidateDecorator('max');

export const Min = createAttrValidateDecorator('min');

export const IsArray = createAttrValidateDecorator('isArray');

export const IsCreditCard = createAttrValidateDecorator('isCreditCard');
