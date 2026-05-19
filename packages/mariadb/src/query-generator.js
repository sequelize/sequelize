'use strict';

import {
  attributeTypeToSql,
  normalizeDataType,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import {
  findTopLevelSqlKeyword,
  removeTopLevelSqlKeyword,
  splitSqlAtTopLevelKeyword,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/generated-columns.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import each from 'lodash/each';
import isPlainObject from 'lodash/isPlainObject';
import { MariaDbQueryGeneratorTypeScript } from './query-generator-typescript.internal.js';

const typeWithoutDefault = new Set(['BLOB', 'TEXT', 'GEOMETRY', 'JSON']);

export class MariaDbQueryGenerator extends MariaDbQueryGeneratorTypeScript {
  createTableQuery(tableName, attributes, options) {
    options = {
      engine: 'InnoDB',
      charset: null,
      rowFormat: null,
      ...options,
    };

    const primaryKeys = [];
    const foreignKeys = {};
    const attrStr = [];

    for (const attr in attributes) {
      if (!Object.hasOwn(attributes, attr)) {
        continue;
      }

      const dataType = attributes[attr];
      const referenceParts = splitSqlAtTopLevelKeyword(dataType, 'REFERENCES', this.dialect);
      const hasPrimaryKey = findTopLevelSqlKeyword(dataType, 'PRIMARY KEY', this.dialect) !== -1;

      if (hasPrimaryKey) {
        primaryKeys.push(attr);

        if (referenceParts) {
          // MariaDB doesn't support inline REFERENCES declarations: move to the end
          attrStr.push(
            `${this.quoteIdentifier(attr)} ${removeTopLevelSqlKeyword(referenceParts[0], 'PRIMARY KEY', this.dialect)}`,
          );
          foreignKeys[attr] = referenceParts[1];
        } else {
          attrStr.push(
            `${this.quoteIdentifier(attr)} ${removeTopLevelSqlKeyword(dataType, 'PRIMARY KEY', this.dialect)}`,
          );
        }
      } else if (referenceParts) {
        // MariaDB doesn't support inline REFERENCES declarations: move to the end
        attrStr.push(`${this.quoteIdentifier(attr)} ${referenceParts[0]}`);
        foreignKeys[attr] = referenceParts[1];
      } else {
        attrStr.push(`${this.quoteIdentifier(attr)} ${dataType}`);
      }
    }

    const table = this.quoteTable(tableName);
    let attributesClause = attrStr.join(', ');
    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    if (options.uniqueKeys) {
      each(options.uniqueKeys, (columns, indexName) => {
        if (typeof indexName !== 'string') {
          indexName = `uniq_${tableName}_${columns.fields.join('_')}`;
        }

        attributesClause += `, UNIQUE ${this.quoteIdentifier(indexName)} (${columns.fields
          .map(field => this.quoteIdentifier(field))
          .join(', ')})`;
      });
    }

    if (pkString.length > 0) {
      attributesClause += `, PRIMARY KEY (${pkString})`;
    }

    for (const fkey in foreignKeys) {
      if (Object.hasOwn(foreignKeys, fkey)) {
        attributesClause += `, FOREIGN KEY (${this.quoteIdentifier(fkey)}) ${foreignKeys[fkey]}`;
      }
    }

    return joinSQLFragments([
      'CREATE TABLE IF NOT EXISTS',
      table,
      `(${attributesClause})`,
      `ENGINE=${options.engine}`,
      options.comment &&
        typeof options.comment === 'string' &&
        `COMMENT ${this.escape(options.comment)}`,
      options.charset && `DEFAULT CHARSET=${options.charset}`,
      options.collate && `COLLATE ${options.collate}`,
      options.initialAutoIncrement && `AUTO_INCREMENT=${options.initialAutoIncrement}`,
      options.rowFormat && `ROW_FORMAT=${options.rowFormat}`,
      ';',
    ]);
  }

  addColumnQuery(table, key, dataType, options = {}) {
    const ifNotExists = options.ifNotExists ? 'IF NOT EXISTS' : '';

    dataType = {
      ...dataType,
      type: normalizeDataType(dataType.type, this.dialect),
    };

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(table),
      'ADD',
      ifNotExists,
      this.quoteIdentifier(key),
      this.attributeToSQL(dataType, {
        context: 'addColumn',
        tableName: table,
        foreignKey: key,
      }),
      ';',
    ]);
  }

  changeColumnQuery(tableName, attributes) {
    const attrString = [];
    const constraintString = [];

    for (const attributeName in attributes) {
      let definition = attributes[attributeName];
      if (definition.includes('REFERENCES')) {
        const attrName = this.quoteIdentifier(attributeName);
        definition = definition.replace(/.+?(?=REFERENCES)/, '');
        constraintString.push(`FOREIGN KEY (${attrName}) ${definition}`);
      } else {
        attrString.push(`\`${attributeName}\` \`${attributeName}\` ${definition}`);
      }
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      attrString.length && `CHANGE ${attrString.join(', ')}`,
      constraintString.length && `ADD ${constraintString.join(', ')}`,
      ';',
    ]);
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const attrString = [];

    for (const attrName in attributes) {
      const definition = attributes[attrName];
      attrString.push(`\`${attrBefore}\` \`${attrName}\` ${definition}`);
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'CHANGE',
      attrString.join(', '),
      ';',
    ]);
  }

  attributeToSQL(attribute, options) {
    if (!isPlainObject(attribute)) {
      attribute = {
        type: attribute,
      };
    }

    const attributeString = attributeTypeToSql(attribute.type, {
      escape: this.escape.bind(this),
      dialect: this.dialect,
    });
    let template = attributeString;

    if (attribute.generatedAs === undefined && attribute.allowNull === false) {
      template += ' NOT NULL';
    }

    if (attribute.generatedAs !== undefined) {
      const expr = this.escape(attribute.generatedAs, { model: options?.model });
      const mode = attribute.generatedColumn === 'VIRTUAL' ? 'VIRTUAL' : 'STORED';
      template += ` GENERATED ALWAYS AS (${expr}) ${mode}`;

      if (attribute.allowNull === false) {
        throw new Error('mariadb does not support NOT NULL on generated columns.');
      }

      if (attribute.unique === true) {
        template += ' UNIQUE';
      }

      if (attribute.primaryKey) {
        throw new Error('mariadb does not support generated columns as primary keys.');
      }

      if (attribute.comment) {
        template += ` COMMENT ${this.escape(attribute.comment)}`;
      }

      if (attribute.first) {
        template += ' FIRST';
      }

      if (attribute.after) {
        template += ` AFTER ${this.quoteIdentifier(attribute.after)}`;
      }

      if ((!options || !options.withoutForeignKeyConstraints) && attribute.references) {
        if (mode === 'VIRTUAL') {
          throw new Error('mariadb only supports foreign keys on STORED generated columns.');
        }

        const onDelete = attribute.onDelete?.toUpperCase();
        const onUpdate = attribute.onUpdate?.toUpperCase();
        if (['SET NULL', 'SET DEFAULT'].includes(onDelete)) {
          throw new Error(`mariadb does not support ON DELETE ${onDelete} on generated columns.`);
        }

        if (['CASCADE', 'SET NULL', 'SET DEFAULT'].includes(onUpdate)) {
          throw new Error(`mariadb does not support ON UPDATE ${onUpdate} on generated columns.`);
        }

        if (options?.context === 'addColumn' && options.foreignKey) {
          const fkName = this.quoteIdentifier(
            `${this.extractTableDetails(options.tableName).tableName}_${options.foreignKey}_foreign_idx`,
          );

          template += `, ADD CONSTRAINT ${fkName} FOREIGN KEY (${this.quoteIdentifier(options.foreignKey)})`;
        }

        template += ` REFERENCES ${this.quoteTable(attribute.references.table)}`;
        template += ` (${this.quoteIdentifier(attribute.references.key ?? 'id')})`;

        if (onDelete) {
          template += ` ON DELETE ${onDelete}`;
        }

        if (onUpdate) {
          template += ` ON UPDATE ${onUpdate}`;
        }
      }

      return template;
    }

    if (attribute.autoIncrement) {
      template += ' auto_increment';
    }

    // BLOB/TEXT/GEOMETRY/JSON cannot have a default value
    if (
      !typeWithoutDefault.has(attributeString) &&
      attribute.type._binary !== true &&
      defaultValueSchemable(attribute.defaultValue, this.dialect)
    ) {
      template += ` DEFAULT ${this.escape(attribute.defaultValue)}`;
    }

    if (attribute.unique === true) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.comment) {
      template += ` COMMENT ${this.escape(attribute.comment)}`;
    }

    if (attribute.first) {
      template += ' FIRST';
    }

    if (attribute.after) {
      template += ` AFTER ${this.quoteIdentifier(attribute.after)}`;
    }

    if ((!options || !options.withoutForeignKeyConstraints) && attribute.references) {
      if (options && options.context === 'addColumn' && options.foreignKey) {
        const fkName = this.quoteIdentifier(
          `${this.extractTableDetails(options.tableName).tableName}_${options.foreignKey}_foreign_idx`,
        );

        template += `, ADD CONSTRAINT ${fkName} FOREIGN KEY (${this.quoteIdentifier(options.foreignKey)})`;
      }

      template += ` REFERENCES ${this.quoteTable(attribute.references.table)}`;

      if (attribute.references.key) {
        template += ` (${this.quoteIdentifier(attribute.references.key)})`;
      } else {
        template += ` (${this.quoteIdentifier('id')})`;
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

  attributesToSQL(attributes, options) {
    const result = {};

    for (const key in attributes) {
      const attribute = attributes[key];
      result[attribute.field || key] = this.attributeToSQL(attribute, options);
    }

    return result;
  }
}
