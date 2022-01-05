import BaseError, { ErrorOptions } from './base-error';
import type { Model } from '../../types/lib/model';

/**
 * An enum that is used internally by the `ValidationErrorItem` class
 * that maps current `type` strings (as given to ValidationErrorItem.constructor()) to
 * our new `origin` values.
 */
export enum ValidationErrorItemType {
  'notnull violation' = 'CORE',
  'string violation' = 'CORE',
  'unique violation' = 'DB',
  'validation error' = 'FUNCTION',
}

/**
 * An enum that defines valid ValidationErrorItem `origin` values
 */
export enum ValidationErrorItemOrigin {
  /**
   * specifies errors that originate from the sequelize "core"
   */
  CORE = 'CORE',

  /**
   * specifies validation errors that originate from the storage engine
   */
  DB = 'DB',

  /**
   * specifies validation errors that originate from validator functions (both built-in and custom) defined for a given attribute
   */
  FUNCTION = 'FUNCTION',
}

/**
 * Validation Error Item
 * Instances of this class are included in the `ValidationError.errors` property.
 */
export class ValidationErrorItem {
  /**
   * @deprecated Will be removed in v7
   */
  static TypeStringMap = ValidationErrorItemType;

  /**
   * @deprecated Will be removed in v7
   */
  static Origins = ValidationErrorItemOrigin;

  /**
   * An error message
   */
  message: string;

  /**
   * The type/origin of the validation error
   */
  type: keyof typeof ValidationErrorItemType | null;

  /**
   * The field that triggered the validation error
   */
  path: string | null;

  /**
   * The value that generated the error
   */
  value: string | null;

  origin: keyof typeof ValidationErrorItemOrigin | null;

  /**
   * The DAO instance that caused the validation error
   */
  instance: Model | null;

  /**
   * A validation "key", used for identification
   */
  validatorKey: string | null;

  /**
   * Property name of the BUILT-IN validator function that caused the validation error (e.g. "in" or "len"), if applicable
   */
  validatorName: string | null;

  /**
   * Parameters used with the BUILT-IN validator function, if applicable
   */
  validatorArgs: unknown[];

  /**
   * Creates a new ValidationError item. Instances of this class are included in the `ValidationError.errors` property.
   *
   * @param message An error message
   * @param type The type/origin of the validation error
   * @param path The field that triggered the validation error
   * @param value The value that generated the error
   * @param instance the DAO instance that caused the validation error
   * @param validatorKey a validation "key", used for identification
   * @param fnName property name of the BUILT-IN validator function that caused the validation error (e.g. "in" or "len"), if applicable
   * @param fnArgs parameters used with the BUILT-IN validator function, if applicable
   */
  constructor(
    message: string,
    type:
      | keyof typeof ValidationErrorItemType
      | keyof typeof ValidationErrorItemOrigin,
    path: string,
    value: string,
    instance: Model,
    validatorKey: string,
    fnName: string,
    fnArgs: unknown[]
  ) {
    this.message = message || '';
    this.type = null;
    this.path = path || null;

    this.value = value !== undefined ? value : null;

    this.origin = null;

    this.instance = instance || null;

    this.validatorKey = validatorKey || null;

    this.validatorName = fnName || null;

    this.validatorArgs = fnArgs || [];

    if (type) {
      if (this.isValidationErrorItemOrigin(type)) {
        this.origin = type;
      } else {
        const lowercaseType = this.normalizeString(type);
        const realType = ValidationErrorItemType[lowercaseType];

        if (realType && ValidationErrorItemOrigin[realType]) {
          this.origin = realType;
          this.type = type;
        }
      }
    }

    // This doesn't need captureStackTrace because it's not a subclass of Error
  }

  private isValidationErrorItemOrigin(
    origin:
      | keyof typeof ValidationErrorItemOrigin
      | keyof typeof ValidationErrorItemType
  ): origin is keyof typeof ValidationErrorItemOrigin {
    return (
      ValidationErrorItemOrigin[
        origin as keyof typeof ValidationErrorItemOrigin
      ] !== undefined
    );
  }

  private normalizeString<T extends string>(str: T): T {
    return str.toLowerCase().trim() as T;
  }

  /**
   * return a lowercase, trimmed string "key" that identifies the validator.
   *
   * Note: the string will be empty if the instance has neither a valid `validatorKey` property nor a valid `validatorName` property
   *
   * @param useTypeAsNS controls whether the returned value is "namespace",
   *                    this parameter is ignored if the validator's `type` is not one of ValidationErrorItem.Origins
   * @param NSSeparator a separator string for concatenating the namespace, must be not be empty,
   *                    defaults to "." (fullstop). only used and validated if useTypeAsNS is TRUE.
   * @throws {Error}    thrown if NSSeparator is found to be invalid.
   */
  getValidatorKey(useTypeAsNS: boolean, NSSeparator: string): string {
    const useTANS = useTypeAsNS === undefined || !!useTypeAsNS;
    const NSSep = NSSeparator === undefined ? '.' : NSSeparator;

    const type = this.origin;
    const key = this.validatorKey || this.validatorName;
    const useNS = useTANS && type && ValidationErrorItemOrigin[type];

    if (useNS && (typeof NSSep !== 'string' || !NSSep.length)) {
      throw new Error('Invalid namespace separator given, must be a non-empty string');
    }

    if (!(typeof key === 'string' && key.length)) {
      return '';
    }

    return (useNS ? [this.origin, key].join(NSSep) : key).toLowerCase().trim();
  }
}

/**
 * Validation Error. Thrown when the sequelize validation has failed. The error contains an `errors` property,
 * which is an array with 1 or more ValidationErrorItems, one for each validation that failed.
 *
 * @param message Error message
 * @param errors Array of ValidationErrorItem objects describing the validation errors
 */
class ValidationError extends BaseError {
  errors: ValidationErrorItem[];

  constructor(
    message: string,
    errors: ValidationErrorItem[],
    options: ErrorOptions = {}
  ) {
    super(message);
    this.name = 'SequelizeValidationError';
    this.message = 'Validation Error';
    this.errors = errors || [];

    // Use provided error message if available...
    if (message) {
      this.message = message;

      // ... otherwise create a concatenated message out of existing errors.
    } else if (this.errors.length > 0 && this.errors[0].message) {
      this.message = this.errors
        .map(
          (err: ValidationErrorItem) =>
            `${err.type || err.origin}: ${err.message}`
        )
        .join(',\n');
    }

    // Allow overriding the stack if the original stacktrace is uninformative
    if (options.stack) {
      this.stack = options.stack;
    }
  }

  /**
   * Gets all validation error items for the path / field specified.
   *
   * @param {string} path The path to be checked for error items
   *
   * @returns {Array<ValidationErrorItem>} Validation error items for the specified path
   */
  get(path: string): ValidationErrorItem[] {
    return this.errors.reduce<ValidationErrorItem[]>((reduced, error) => {
      if (error.path === path) {
        reduced.push(error);
      }
      return reduced;
    }, []);
  }
}

export default ValidationError;
