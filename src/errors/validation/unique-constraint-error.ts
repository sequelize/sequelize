import { CommonErrorProperties, ErrorOptions } from '../base-error';
import ValidationError, { ValidationErrorItem } from '../validation-error';

interface UniqueConstraintErrorParent
  extends Error,
    Pick<CommonErrorProperties, 'sql'> {}

export interface UniqueConstraintErrorOptions extends ErrorOptions {
  parent?: UniqueConstraintErrorParent;
  original?: UniqueConstraintErrorParent;
  errors?: ValidationErrorItem[];
  fields?: Record<string, unknown>;
  message?: string;
}

/**
 * Thrown when a unique constraint is violated in the database
 */
class UniqueConstraintError extends ValidationError implements CommonErrorProperties {
  readonly parent: UniqueConstraintErrorParent;
  readonly original: UniqueConstraintErrorParent;
  readonly fields: Record<string, unknown>;
  readonly sql: string;

  constructor(options: UniqueConstraintErrorOptions) {
    options = options ?? {};
    options.parent = options.parent ?? { sql: '', name: '', message: '' };
    options.message =
      options.message || options.parent.message || 'Validation Error';
    options.errors = options.errors ?? [];
    super(options.message, options.errors, { stack: options.stack });

    this.name = 'SequelizeUniqueConstraintError';
    this.fields = options.fields ?? {};
    this.parent = options.parent;
    this.original = options.parent;
    this.sql = options.parent.sql;
  }
}

export default UniqueConstraintError;
