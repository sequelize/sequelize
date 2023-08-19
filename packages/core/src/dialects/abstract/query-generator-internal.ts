import type { Sequelize } from '../../sequelize.js';
import { isDataType } from './data-types-utils.js';
import type { DataType } from './data-types.js';
import type { ChangeColumnDefinition, NormalizedChangeColumnDefinition } from './query-generator.types.js';
import type { TableNameWithSchema } from './query-interface.js';
import type { AbstractDialect } from './index.js';

/**
 * The methods in this class are not part of the public API.
 */
export class AbstractQueryGeneratorInternal {
  readonly #dialect: AbstractDialect;

  protected get sequelize(): Sequelize {
    return this.#dialect.sequelize;
  }

  constructor(dialect: AbstractDialect) {
    this.#dialect = dialect;
  }

  /**
   * Part of the implementation of {@link AbstractQueryGenerator#changeColumnsQuery}
   *
   * @param _tableName
   * @param _columnName
   * @param _columnDefinition
   */
  attributeToChangeColumn(
    _tableName: TableNameWithSchema,
    _columnName: string,
    _columnDefinition: NormalizedChangeColumnDefinition,
  ): string {
    throw new Error(`attributeToChangeColumn has not been implemented in ${this.constructor.name}`);
  }
}

export function normalizeChangeColumnAttribute(
  sequelize: Sequelize,
  attribute: DataType | ChangeColumnDefinition,
): NormalizedChangeColumnDefinition {
  if (isDataType(attribute)) {
    return { type: sequelize.normalizeDataType(attribute) };
  }

  if (attribute.type == null) {
    return {
      ...attribute,
      type: undefined,
    };
  }

  return {
    ...attribute,
    type: sequelize.normalizeDataType(attribute.type),
  };
}
