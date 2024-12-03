'use strict';

import {
  ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { quoteIdentifier } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dialect.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import each from 'lodash/each';
import isPlainObject from 'lodash/isPlainObject';
import { SnowflakeQueryGeneratorTypeScript } from './query-generator-typescript.internal.js';

/**
 * list of reserved words in Snowflake
 * source: https://docs.snowflake.com/en/sql-reference/reserved-keywords.html
 *
 * @private
 */
const SNOWFLAKE_RESERVED_WORDS =
  'account,all,alter,and,any,as,between,by,case,cast,check,column,connect,connections,constraint,create,cross,current,current_date,current_time,current_timestamp,current_user,database,delete,distinct,drop,else,exists,false,following,for,from,full,grant,group,gscluster,having,ilike,in,increment,inner,insert,intersect,into,is,issue,join,lateral,left,like,localtime,localtimestamp,minus,natural,not,null,of,on,or,order,organization,qualify,regexp,revoke,right,rlike,row,rows,sample,schema,select,set,some,start,table,tablesample,then,to,trigger,true,try_cast,union,unique,update,using,values,view,when,whenever,where,with'.split(
    ',',
  );

const typeWithoutDefault = new Set(['BLOB', 'TEXT', 'GEOMETRY', 'JSON']);

const CREATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set(['comment', 'uniqueKeys']);

export class SnowflakeQueryGenerator extends SnowflakeQueryGeneratorTypeScript {
  createTableQuery(tableName, attributes, options) {
    if (options) {
      rejectInvalidOptions(
        'createTableQuery',
        this.dialect,
        CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        CREATE_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    options = {
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

      let dataType = attributes[attr];
      let match;

      if (dataType.includes('AUTOINCREMENT')) {
        // Replace AUTOINCREMENT with DEFAULT <sequence name>.NEXTVAL
        const tblPart = tableName.tableName ? tableName.tableName : tableName;
        const sequenceName = this.quoteIdentifier(`${tblPart}_${attr}_seq`);
        dataType = dataType.replace('AUTOINCREMENT', `DEFAULT ${sequenceName}.NEXTVAL`);
      }

      if (dataType.includes('PRIMARY KEY')) {
        primaryKeys.push(attr);

        if (dataType.includes('REFERENCES')) {
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(`${this.quoteIdentifier(attr)} ${match[1].replace('PRIMARY KEY', '')}`);
          foreignKeys[attr] = match[2];
        } else {
          attrStr.push(`${this.quoteIdentifier(attr)} ${dataType.replace('PRIMARY KEY', '')}`);
        }
      } else if (dataType.includes('REFERENCES')) {
        match = dataType.match(/^(.+) (REFERENCES.*)$/);
        attrStr.push(`${this.quoteIdentifier(attr)} ${match[1]}`);
        foreignKeys[attr] = match[2];
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

        attributesClause += `, UNIQUE ${this.quoteIdentifier(indexName)} (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ')})`;
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
      options.comment &&
        typeof options.comment === 'string' &&
        `COMMENT ${this.escape(options.comment)}`,
      ';',
    ]);
  }

  addColumnQuery(table, key, dataType, options) {
    if (options) {
      rejectInvalidOptions(
        'addColumnQuery',
        this.dialect,
        ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
        options,
      );
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(table),
      'ADD',
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
    const query = (...subQuerys) =>
      joinSQLFragments([
        'ALTER TABLE',
        this.quoteTable(tableName),
        'ALTER COLUMN',
        ...subQuerys,
        ';',
      ]);
    const sql = [];
    for (const attributeName in attributes) {
      let definition = this.dataTypeMapping(tableName, attributeName, attributes[attributeName]);
      const attrSql = [];

      if (definition.includes('NOT NULL')) {
        attrSql.push(query(this.quoteIdentifier(attributeName), 'SET NOT NULL'));

        definition = definition.replace('NOT NULL', '').trim();
      } else if (!definition.includes('REFERENCES')) {
        attrSql.push(query(this.quoteIdentifier(attributeName), 'DROP NOT NULL'));
      }

      if (definition.includes('DEFAULT')) {
        attrSql.push(
          query(
            this.quoteIdentifier(attributeName),
            'SET DEFAULT',
            definition.match(/DEFAULT ([^;]+)/)[1],
          ),
        );

        definition = definition.replace(/(DEFAULT[^;]+)/, '').trim();
      } else if (!definition.includes('REFERENCES')) {
        attrSql.push(query(this.quoteIdentifier(attributeName), 'DROP DEFAULT'));
      }

      if (/UNIQUE;*$/.test(definition)) {
        definition = definition.replace(/UNIQUE;*$/, '');
        attrSql.push(
          query('ADD UNIQUE (', this.quoteIdentifier(attributeName), ')').replace(
            'ALTER COLUMN',
            '',
          ),
        );
      }

      if (definition.includes('REFERENCES')) {
        definition = definition.replace(/.+?(?=REFERENCES)/, '');
        attrSql.push(
          query('ADD FOREIGN KEY (', this.quoteIdentifier(attributeName), ')', definition).replace(
            'ALTER COLUMN',
            '',
          ),
        );
      } else {
        attrSql.push(query(this.quoteIdentifier(attributeName), 'TYPE', definition));
      }

      sql.push(attrSql.join(''));
    }

    return sql.join('');
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const attrString = [];

    for (const attrName in attributes) {
      const definition = attributes[attrName];
      attrString.push(`'${attrBefore}' '${attrName}' ${definition}`);
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'RENAME COLUMN',
      attrString.join(' to '),
      ';',
    ]);
  }

  attributeToSQL(attribute, options) {
    if (!isPlainObject(attribute)) {
      attribute = {
        type: attribute,
      };
    }

    const attributeString = attribute.type.toString({ dialect: this.dialect });
    let template = attributeString;

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    }

    if (attribute.autoIncrement) {
      template += ' AUTOINCREMENT';
    }

    // BLOB/TEXT/GEOMETRY/JSON cannot have a default value
    if (
      !typeWithoutDefault.has(attributeString) &&
      attribute.type._binary !== true &&
      defaultValueSchemable(attribute.defaultValue, this.dialect)
    ) {
      template += ` DEFAULT ${this.escape(attribute.defaultValue, { ...options, type: attribute.type })}`;
    }

    if (attribute.unique === true) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.comment) {
      template += ` COMMENT ${this.escape(attribute.comment, options)}`;
    }

    if (attribute.first) {
      template += ' FIRST';
    }

    if (attribute.after) {
      template += ` AFTER ${this.quoteIdentifier(attribute.after)}`;
    }

    if (attribute.references) {
      if (options && options.context === 'addColumn' && options.foreignKey) {
        const attrName = this.quoteIdentifier(options.foreignKey);
        const fkName = this.quoteIdentifier(`${options.tableName}_${attrName}_foreign_idx`);

        template += `, ADD CONSTRAINT ${fkName} FOREIGN KEY (${attrName})`;
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

  dataTypeMapping(tableName, attr, dataType) {
    if (dataType.includes('PRIMARY KEY')) {
      dataType = dataType.replace('PRIMARY KEY', '');
    }

    if (dataType.includes('SERIAL')) {
      if (dataType.includes('BIGINT')) {
        dataType = dataType.replace('SERIAL', 'BIGSERIAL');
        dataType = dataType.replace('BIGINT', '');
      } else if (dataType.includes('SMALLINT')) {
        dataType = dataType.replace('SERIAL', 'SMALLSERIAL');
        dataType = dataType.replace('SMALLINT', '');
      } else {
        dataType = dataType.replace('INTEGER', '');
      }

      dataType = dataType.replace('NOT NULL', '');
    }

    return dataType;
  }

  /**
   * Quote identifier in sql clause
   *
   * @param {string} identifier
   * @param {boolean} force
   *
   * @returns {string}
   */
  quoteIdentifier(identifier, force) {
    const optForceQuote = force || false;
    // TODO [>7]: remove "quoteIdentifiers: false" option
    const optQuoteIdentifiers = this.options.quoteIdentifiers !== false;

    if (
      optForceQuote === true ||
      // TODO [>7]: drop this.options.quoteIdentifiers. Always quote identifiers.
      optQuoteIdentifiers !== false ||
      identifier.includes('.') ||
      identifier.includes('->') ||
      SNOWFLAKE_RESERVED_WORDS.includes(identifier.toLowerCase())
    ) {
      // In Snowflake if tables or attributes are created double-quoted,
      // they are also case sensitive. If they contain any uppercase
      // characters, they must always be double-quoted. This makes it
      // impossible to write queries in portable SQL if tables are created in
      // this way. Hence, we strip quotes if we don't want case sensitivity.
      return quoteIdentifier(identifier, this.dialect.TICK_CHAR_LEFT, this.dialect.TICK_CHAR_RIGHT);
    }

    return identifier;
  }
}
