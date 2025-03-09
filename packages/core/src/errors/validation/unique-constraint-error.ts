import { useErrorCause } from '../../utils/deprecations.js';
import type { CommonErrorProperties } from '../base-error';
import type { ValidationErrorItem } from '../validation-error';
import { ValidationError } from '../validation-error';

interface UniqueConstraintErrorParent extends Error, Pick<CommonErrorProperties, 'sql'> {}

export interface UniqueConstraintErrorOptions {
  cause?: UniqueConstraintErrorParent;

  /**
   * @deprecated use {@link UniqueConstraintErrorOptions.cause}
   */
  parent?: UniqueConstraintErrorParent;
  errors?: ValidationErrorItem[];
  fields?: Record<string, unknown>;
  message?: string;
}

/**
 * Thrown when a unique constraint is violated in the database
 */
export class UniqueConstraintError extends ValidationError {
  /** The database-specific error which triggered this one */
  declare cause?: UniqueConstraintErrorParent;

  readonly fields: Record<string, unknown>;
  readonly sql: string;

  constructor(options: UniqueConstraintErrorOptions = {}) {
    if ('parent' in options) {
      useErrorCause();
    }

    const parent = options.cause ?? options.parent ?? { sql: '', name: '', message: '' };
    const message = options.message || parent.message || 'Validation Error';
    const errors = options.errors ?? [];
    super(message, errors, { cause: parent });

    this.name = 'SequelizeUniqueConstraintError';
    this.fields = options.fields ?? {};
    this.sql = parent.sql;
  }
}
