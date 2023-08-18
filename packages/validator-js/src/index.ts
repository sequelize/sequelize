import type { ColumnValidateOptions } from '@sequelize/core';
import {
  createOptionalAttributeOptionsDecorator,
  createRequiredAttributeOptionsDecorator,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/decorators/legacy/attribute-utils.js';
import type {
  OptionalParameterizedPropertyDecorator,
  RequiredParameterizedPropertyDecorator,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/decorators/legacy/decorator-utils.js';
import upperFirst from 'lodash/upperFirst.js';

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

// TODO: rename to Matches
export const Is = createRequiredAttributeValidationDecorator('is');

// TODO: rename to NotMatches
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

// TODO: rename IsLength
export const Len = createRequiredAttributeValidationDecorator('len');

export const IsUUID = createRequiredAttributeValidationDecorator('isUUID');

export const IsDate = createOptionalAttributeValidationDecorator('isDate', true);

export const IsAfter = createRequiredAttributeValidationDecorator('isAfter');

export const IsBefore = createRequiredAttributeValidationDecorator('isBefore');

// TODO: rename to MaxLength
export const Max = createRequiredAttributeValidationDecorator('max');

// TODO: rename to MinLength
export const Min = createRequiredAttributeValidationDecorator('min');

export const IsArray = createOptionalAttributeValidationDecorator('isArray', true);

export const IsCreditCard = createOptionalAttributeValidationDecorator('isCreditCard', true);
