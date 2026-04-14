import type { AbstractDialect } from '../abstract-dialect/dialect.js';
import { VIRTUAL } from '../data-types.js';
import { BaseSqlExpression } from '../expression-builders/base-sql-expression.js';

interface GeneratedColumnOptions {
  autoIncrement?: boolean | undefined;
  defaultValue?: unknown;
  generatedAs?: unknown;
  generatedColumn?: unknown;
  type?: unknown;
}

/**
 * Validates the options shared by model attributes and QueryInterface column definitions.
 *
 * @param attribute The attribute definition to validate.
 * @param dialect The dialect the attribute will be used with.
 * @param attributeDescription A human-readable attribute identifier for errors.
 */
export function validateGeneratedColumnOptions(
  attribute: GeneratedColumnOptions,
  dialect: AbstractDialect,
  attributeDescription: string,
): void {
  if (attribute.generatedColumn !== undefined && attribute.generatedAs === undefined) {
    throw new Error(
      `${attributeDescription}: "generatedColumn" requires "generatedAs" to be specified.`,
    );
  }

  if (attribute.generatedAs === undefined) {
    return;
  }

  if (!(attribute.generatedAs instanceof BaseSqlExpression)) {
    throw new TypeError(
      `${attributeDescription}: "generatedAs" must be a Sequelize SQL expression (for example, one created with the sql template tag or sql.fn).`,
    );
  }

  if (attribute.type instanceof VIRTUAL) {
    throw new TypeError(
      `${attributeDescription}: A generated column cannot use DataTypes.VIRTUAL because generated columns are physical database columns.`,
    );
  }

  const mode = attribute.generatedColumn ?? 'STORED';
  if (mode !== 'STORED' && mode !== 'VIRTUAL') {
    throw new Error(
      `${attributeDescription}: "generatedColumn" must be either "STORED" or "VIRTUAL".`,
    );
  }

  if (Object.hasOwn(attribute, 'defaultValue')) {
    throw new Error(`${attributeDescription}: A generated column cannot have a defaultValue.`);
  }

  if (attribute.autoIncrement) {
    throw new Error(`${attributeDescription}: A generated column cannot be autoIncrement.`);
  }

  const supports = dialect.supports.generatedColumns;
  if (!supports.stored && !supports.virtual) {
    throw new Error(
      `${attributeDescription}: The ${dialect.name} dialect does not support generated columns.`,
    );
  }

  if (mode === 'STORED' && !supports.stored) {
    throw new Error(
      `${attributeDescription}: The ${dialect.name} dialect does not support STORED generated columns.`,
    );
  }

  if (mode === 'VIRTUAL' && !supports.virtual) {
    throw new Error(
      `${attributeDescription}: The ${dialect.name} dialect does not support VIRTUAL generated columns.`,
    );
  }
}
