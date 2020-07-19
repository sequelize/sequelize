import BaseError from './base-error';

/**
 * Validation Error. Thrown when the sequelize validation has failed. The error contains an `errors` property,
 * which is an array with 1 or more ValidationErrorItems, one for each validation that failed.
 *
 * @param {string} message Error message
 * @param {Array} [errors] Array of ValidationErrorItem objects describing the validation errors
 *
 * @property errors {ValidationErrorItems[]}
 */
class ValidationError extends BaseError {
  errors: Array<ValidationErrorItem>;

  constructor(message: string, errors: Array<ValidationErrorItem>) {
    super(message);
    this.name = 'SequelizeValidationError';
    this.message = 'Validation Error';

    /**
     *
     * @type {ValidationErrorItem[]}
     */
    this.errors = errors || [];

    // Use provided error message if available...
    if (message) {
      this.message = message;

      // ... otherwise create a concatenated message out of existing errors.
    } else if (this.errors.length > 0 && this.errors[0].message) {
      this.message = this.errors.map(err => `${err.type || err.origin || 'Unknown'}: ${err.message}`).join(',\n');
    }
  }

  /**
   * Gets all validation error items for the path / field specified.
   *
   * @param {string} path The path to be checked for error items
   */
  get(path: string): ValidationErrorItem[] {
    return this.errors.reduce((reduced, error) => {
      if (error.path === path) {
        reduced.push(error);
      }
      return reduced;
    }, [] as ValidationErrorItem[]);
  }
}

/**
 * An enum that defines valid ValidationErrorItem `origin` values
 *
 * @property CORE       {string}  specifies errors that originate from the sequelize "core"
 * @property DB         {string}  specifies validation errors that originate from the storage engine
 * @property FUNCTION   {string}  specifies validation errors that originate from validator functions (both built-in and custom) defined for a given attribute
 */
enum Origins {
  CORE = 'CORE',
  DB = 'DB',
  FUNCTION = 'FUNCTION'
}

/**
 * An object that is used internally by the `ValidationErrorItem` class
 * that maps current `type` strings (as given to ValidationErrorItem.constructor()) to
 * our new `origin` values.
 */
enum TypeStringMap {
  'notnull violation' = 'CORE',
  'string violation' = 'CORE',
  'unique violation' = 'DB',
  'validation error' = 'FUNCTION'
}

/**
 * Validation Error Item
 * Instances of this class are included in the `ValidationError.errors` property.
 */
export class ValidationErrorItem {
  message: string;
  type: keyof typeof Origins | string | null;
  path: string | null;
  value: string | null;
  origin?: keyof typeof Origins | null;
  instance: object | null;
  validatorKey: string | null;
  validatorName: string | null;
  validatorArgs: unknown[];

  static Origins = Origins;
  static TypeStringMap = TypeStringMap;

  /**
   * Creates new validation error item
   *
   * @param {string} message An error message
   * @param {string} type The type/origin of the validation error
   * @param {string} path The field that triggered the validation error
   * @param {string} value The value that generated the error
   * @param {object} [inst] the DAO instance that caused the validation error
   * @param {string} [validatorKey] a validation "key", used for identification
   * @param {string} [fnName] property name of the BUILT-IN validator function that caused the validation error (e.g. "in" or "len"), if applicable
   * @param {unknown[]} [fnArgs] parameters used with the BUILT-IN validator function, if applicable
   */
  constructor(
    message: string,
    type?: keyof typeof Origins | string,
    path?: string,
    value?: string,
    inst?: object,
    validatorKey?: string,
    fnName?: string,
    fnArgs?: unknown[]
  ) {
    /**
     * An error message
     *
     * @type {string} message
     */
    this.message = message || '';

    /**
     * The type/origin of the validation error
     *
     * @type {string}
     */
    this.type = type || null;
    this.origin = null;

    /**
     * The field that triggered the validation error
     *
     * @type {string}
     */
    this.path = path || null;

    /**
     * The value that generated the error
     *
     * @type {string}
     */
    this.value = value !== undefined ? value : null;

    /**
     * The DAO instance that caused the validation error
     *
     * @type {Model}
     */
    this.instance = inst || null;

    /**
     * A validation "key", used for identification
     *
     * @type {string}
     */
    this.validatorKey = validatorKey || null;

    /**
     * Property name of the BUILT-IN validator function that caused the validation error (e.g. "in" or "len"), if applicable
     *
     * @type {string}
     */
    this.validatorName = fnName || null;

    /**
     * Parameters used with the BUILT-IN validator function, if applicable
     *
     * @type {unknown[]}
     */
    this.validatorArgs = fnArgs || [];

    if (type) {
      if (ValidationErrorItem.Origins[type as keyof typeof Origins]) {
        this.origin = type as keyof typeof Origins;
      } else {
        const lowercaseType = `${type}`.toLowerCase().trim();
        const realType = TypeStringMap[lowercaseType as keyof typeof TypeStringMap];

        if (realType && ValidationErrorItem.Origins[realType]) {
          this.origin = realType;
          this.type = type;
        }
      }
    }
  }

  /**
   * return a lowercase, trimmed string "key" that identifies the validator.
   *
   * Note: the string will be empty if the instance has neither a valid `validatorKey` property nor a valid `validatorName` property
   *
   * @param   {boolean} [useTypeAsNS=true]      controls whether the returned value is "namespace",
   *                                            this parameter is ignored if the validator's `type` is not one of ValidationErrorItem.Origins
   * @param   {string}  [NSSeparator='.']       a separator string for concatenating the namespace, must be not be empty,
   *                                            defaults to "." (fullstop). only used and validated if useTypeAsNS is TRUE.
   * @throws  {Error}                           thrown if NSSeparator is found to be invalid.
   * @returns  {string}
   *
   * @private
   */
  getValidatorKey(useTypeAsNS: boolean, NSSeparator: string): string {
    const useTANS = useTypeAsNS === undefined || !!useTypeAsNS;
    const NSSep = NSSeparator === undefined ? '.' : NSSeparator;

    const type = this.origin;
    const key = this.validatorKey || this.validatorName;
    const useNS = useTANS && type && ValidationErrorItem.Origins[type];

    if (useNS && (typeof NSSep !== 'string' || !NSSep.length)) {
      throw new Error('Invalid namespace separator given, must be a non-empty string');
    }

    if (!(typeof key === 'string' && key.length)) {
      return '';
    }

    return (useNS ? [type, key].join(NSSep) : key).toLowerCase().trim();
  }
}

export default ValidationError;
