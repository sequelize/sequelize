import type { ColumnValidateOptions, ModelOptions } from '../../model.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { registerModelOptions } from '../shared/model.js';
import { createRequiredAttributeOptionsDecorator } from './attribute-utils.js';
import {
  createOptionallyParameterizedPropertyDecorator,
  throwMustBeMethod,
  throwMustBeModel,
} from './decorator-utils.js';

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
 *   @ModelValidator
 *   onValidate() {
 *     if (this.name !== VALID_NAME) {
 *       throw new Error(ERROR_MESSAGE);
 *     }
 *   }
 *
 *   @ModelValidator
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
      throwMustBeModel('ModelValidator', target, propertyName);
    }

    // @ts-expect-error -- it's normal to get any here
    const property = target[propertyName];
    if (typeof property !== 'function') {
      throwMustBeMethod('ModelValidator', target, propertyName);
    }

    const validator = isStatic
      ? function validate() {
          // When registered as a static method, the model is passed as the first parameter, and the context ("this") must be the class
          /* eslint-disable @typescript-eslint/no-invalid-this */
          // @ts-expect-error -- description above ^
          property.call(target, this);
          /* eslint-enable @typescript-eslint/no-invalid-this */
        }
      : property;

    registerModelOptions(targetClass, {
      validate: {
        [propertyName]: validator,
      },
    });
  },
);
