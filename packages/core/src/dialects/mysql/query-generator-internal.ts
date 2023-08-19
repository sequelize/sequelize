import assert from 'node:assert';
import { inspect } from 'node:util';
import pick from 'lodash/pick.js';
import { ABSTRACT } from '../../data-types.js';
import { normalizeReference } from '../../model-definition.js';
import type { AttributeOptions } from '../../model.js';
import { defaultValueSchemable } from '../../utils/query-builder-utils.js';
import { generateIndexName } from '../../utils/string.js';
import type { NonNullishRequiredBy } from '../../utils/types.js';
import { attributeTypeToSql, isDataType } from '../abstract/data-types-utils.js';
import type { DataType, NormalizedDataType } from '../abstract/data-types.js';
import { AbstractQueryGeneratorInternal } from '../abstract/query-generator-internal.js';
import type { NormalizedChangeColumnDefinition } from '../abstract/query-generator.types.js';
import type { TableNameWithSchema } from '../abstract/query-interface.js';
import { PROPERTIES_NEEDING_CHANGE_COLUMN } from './query-generator-typescript.js';
import type { MySqlQueryGenerator } from './query-generator.js';
import type { MysqlDialect } from './index.js';

type ColumnDefinition = Pick<
    NonNullishRequiredBy<NormalizedChangeColumnDefinition, 'type'>,
    'type' | 'allowNull' | 'autoIncrement' | 'defaultValue' | 'unique' | 'comment'
>;

export class MySqlQueryGeneratorInternal extends AbstractQueryGeneratorInternal {
  readonly #dialect: MysqlDialect;

  get #qg(): MySqlQueryGenerator {
    return this.#dialect.queryGenerator;
  }

  constructor(dialect: MysqlDialect) {
    super(dialect);

    this.#dialect = dialect;
  }

  attributeToChangeColumn(
    table: TableNameWithSchema,
    columnName: string,
    columnDefinition: NormalizedChangeColumnDefinition,
  ) {
    const {
      unique,
      autoIncrementIdentity,
      defaultValue, dropDefaultValue,
      references, onUpdate, onDelete,
    } = columnDefinition;

    if (autoIncrementIdentity !== undefined) {
      throw new Error(`${this.#dialect.name} does not support autoIncrementIdentity`);
    }

    const sql = [];

    const fieldsForChangeColumn = Object.values(pick(columnDefinition, PROPERTIES_NEEDING_CHANGE_COLUMN));

    // TABLE t1 MODIFY b INT NOT NULL;
    if (fieldsForChangeColumn.some(val => val !== undefined)) {

      if (fieldsForChangeColumn.includes(undefined) || (defaultValue === undefined && dropDefaultValue !== true)) {
        throw new Error(`In ${this.#dialect.name}, changeColumnsQuery uses CHANGE COLUMN, which requires specifying the complete column definition.
To prevent unintended changes to the properties of the column, we require that if one of the following properties is specified (set to a non-undefined value):
> type, allowNull, autoIncrement, comment
Then all of the following properties must be specified too (set to a non-undefined value):
> type, allowNull, autoIncrement, comment, defaultValue (or set dropDefaultValue to true)
Table: ${this.#qg.quoteTable(table)}
Column: ${this.#qg.quoteIdentifier(columnName)}`);
      }

      assert(columnDefinition.type != null);

      sql.push(`MODIFY ${this.#qg.quoteIdentifier(columnName)} ${this.#getColumnDefinitionFragment(columnDefinition as ColumnDefinition)}`);
    } else {
      // if MODIFY COLUMN is used, we don't need to include these, as they will be changed by MODIFY COLUMN anyway

      if (defaultValue !== undefined) {
        sql.push(`ALTER COLUMN ${this.#qg.quoteIdentifier(columnName)} SET DEFAULT ${this.#qg.escape(columnDefinition.defaultValue)}`);
      }

      if (dropDefaultValue) {
        sql.push(`ALTER COLUMN ${this.#qg.quoteIdentifier(columnName)} DROP DEFAULT`);
      }
    }

    // only 'true' is accepted for unique in changeColumns, because they're single column uniques.
    // more complex uniques use addIndex and removing a unique uses removeIndex
    if (unique === true) {
      const uniqueName = generateIndexName(table.tableName, {
        fields: [columnName],
        unique: true,
      });

      sql.push(`ADD CONSTRAINT ${this.#qg.quoteIdentifier(uniqueName)} UNIQUE (${this.#qg.quoteIdentifier(columnName)})`);
    }

    if (references !== undefined) {
      const normalizedReferences = normalizeReference(references)!;

      const targetTable = this.#qg.extractTableDetails(normalizedReferences.table);

      let fkSql = `ADD FOREIGN KEY (${this.#qg.quoteIdentifier(columnName)}) REFERENCES ${this.#qg.quoteTable(targetTable)}`;
      // !TODO: add integration test for this.
      if (normalizedReferences.key) {
        fkSql += `(${this.#qg.quoteIdentifier(normalizedReferences.key)})`;
      }

      if (onUpdate) {
        fkSql += ` ON UPDATE ${onUpdate}`;
      }

      if (onDelete) {
        fkSql += ` ON DELETE ${onDelete}`;
      }

      if (normalizedReferences.deferrable) {
        fkSql += ` ${this.getDeferrableConstraintSnippet(normalizedReferences.deferrable)}`;
      }

      sql.push(fkSql);
    }

    return sql.join(', ');
  }

  #getColumnDefinitionFragment(
    columnDefinition: ColumnDefinition,
  ): string {
    const typeSql = attributeTypeToSql(columnDefinition.type);
    let out = typeSql;
    if (columnDefinition.allowNull === false) {
      out += ' NOT NULL';
    }

    if (columnDefinition.autoIncrement) {
      out += ' AUTO_INCREMENT';
    }

    if (defaultValueSchemable(columnDefinition.defaultValue)) {
      if (columnDefinition.type instanceof ABSTRACT && !columnDefinition.type.canHaveDefaultValue()) {
        throw new Error(`Type ${typeSql} cannot have a default value, but one was provided: ${inspect(columnDefinition.defaultValue)}.`);
      }

      out += ` DEFAULT ${this.#qg.escape(columnDefinition.defaultValue)}`;
    }

    if (columnDefinition.unique === true) {
      out += ' UNIQUE';
    }

    if (columnDefinition.comment) {
      out += ` COMMENT ${this.#qg.escape(columnDefinition.comment)}`;
    }

    return out;
  }

  // TODO: this method is a mess that accepts different options depending on the context. Split into addColumn and createTable methods.
  attributeToSql(
    rawAttribute: AttributeOptions | DataType,
    options?: {
      withoutForeignKeyConstraints?: boolean,
      foreignKey?: string,
      table: TableNameWithSchema,
      context: 'addColumn' | 'createTable',
    },
  ) {
    type NormalizedAttribute = Omit<AttributeOptions, 'type' | 'unique'> & {
      type: NormalizedDataType,
      unique?: boolean,
    };

    const attribute: NormalizedAttribute = isDataType(rawAttribute)
        ? {
          type: this.sequelize.normalizeDataType(rawAttribute),
        }
        : {
          ...rawAttribute,
          type: this.sequelize.normalizeDataType(rawAttribute.type),
          unique: Boolean(rawAttribute.unique),
        };

    let template = this.#getColumnDefinitionFragment(attribute);

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    // @ts-expect-error -- specific to addColumn
    if (attribute.first) {
      template += ' FIRST';
    }

    // @ts-expect-error -- specific to addColumn
    if (attribute.after) {
      // @ts-expect-error -- specific to addColumn
      template += ` AFTER ${this.qg.quoteIdentifier(attribute.after)}`;
    }

    if ((!options?.withoutForeignKeyConstraints) && attribute.references) {
      const normalizedReferences = normalizeReference(attribute.references)!;

      if (options?.context === 'addColumn' && options.foreignKey) {
        const fkName = this.#qg.quoteIdentifier(`${this.#qg.extractTableDetails(options.table).tableName}_${options.foreignKey}_foreign_idx`);

        template += `, ADD CONSTRAINT ${fkName} FOREIGN KEY (${this.#qg.quoteIdentifier(options.foreignKey)})`;
      }

      template += ` REFERENCES ${this.#qg.quoteTable(normalizedReferences.table)}`;

      if (normalizedReferences.key) {
        template += ` (${this.#qg.quoteIdentifier(normalizedReferences.key)})`;
      }

      if (attribute.onDelete) {
        template += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
      }

      if (attribute.onUpdate) {
        template += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
      }
    }

    return template;
  }
}
