'use strict';

const Utils = require('../../utils');
const Transaction = require('../../transaction');
const _ = require('lodash');
const MySqlQueryGenerator = require('../mysql/query-generator');
const AbstractQueryGenerator = require('../abstract/query-generator');

const { Slot, Composition, CompositionGroup } = require('../abstract/query-generator/composition');

class SQLiteQueryGenerator extends MySqlQueryGenerator {
  createSchema() {
    return "SELECT name FROM `sqlite_master` WHERE type='table' and name!='sqlite_sequence';";
  }

  showSchemasQuery() {
    return "SELECT name FROM `sqlite_master` WHERE type='table' and name!='sqlite_sequence';";
  }

  versionQuery() {
    return 'SELECT sqlite_version() as `version`';
  }

  createTableQuery(tableName, attributes, options) {
    options = options || {};

    const primaryKeys = [];
    const needsMultiplePrimaryKeys = _.values(attributes).filter(definition => definition.includes('PRIMARY KEY')).length > 1;
    const attrArray = [];

    for (const attr in attributes) {
      if (attributes.hasOwnProperty(attr)) {
        const dataType = attributes[attr];
        const containsAutoIncrement = dataType.includes('AUTOINCREMENT');

        let dataTypeString = dataType;
        if (dataType.includes('PRIMARY KEY')) {
          if (dataType.includes('INT')) {
            // Only INTEGER is allowed for primary key, see https://github.com/sequelize/sequelize/issues/969 (no lenght, unsigned etc)
            dataTypeString = containsAutoIncrement ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INTEGER PRIMARY KEY';

            if (dataType.includes(' REFERENCES')) {
              dataTypeString += dataType.substr(dataType.indexOf(' REFERENCES'));
            }
          }

          if (needsMultiplePrimaryKeys) {
            primaryKeys.push(attr);
            dataTypeString = dataType.replace('PRIMARY KEY', 'NOT NULL');
          }
        }
        attrArray.push(`${this.quoteIdentifier(attr)} ${dataTypeString}`);
      }
    }

    const table = this.quoteTable(tableName);
    let attrStr = attrArray.join(', ');
    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    if (options.uniqueKeys) {
      _.each(options.uniqueKeys, columns => {
        if (columns.customIndex) {
          attrStr += `, UNIQUE (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ')})`;
        }
      });
    }

    if (pkString.length > 0) {
      attrStr += `, PRIMARY KEY (${pkString})`;
    }

    const sql = `CREATE TABLE IF NOT EXISTS ${table} (${attrStr});`;
    return this.replaceBooleanDefaults(sql);
  }

  booleanValue(value) {
    return value ? 1 : 0;
  }

  /**
   * Check whether the statmement is json function or simple path
   *
   * @param   {string}  stmt  The statement to validate
   * @returns {boolean}       true if the given statement is json function
   * @throws  {Error}         throw if the statement looks like json function but has invalid token
   */
  _checkValidJsonStatement(stmt) {
    if (typeof stmt !== 'string') {
      return false;
    }

    // https://sqlite.org/json1.html
    const jsonFunctionRegex = /^\s*(json(?:_[a-z]+){0,2})\([^)]*\)/i;
    const tokenCaptureRegex = /^\s*((?:([`"'])(?:(?!\2).|\2{2})*\2)|[\w\d\s]+|[().,;+-])/i;

    let currentIndex = 0;
    let openingBrackets = 0;
    let closingBrackets = 0;
    let hasJsonFunction = false;
    let hasInvalidToken = false;

    while (currentIndex < stmt.length) {
      const string = stmt.substr(currentIndex);
      const functionMatches = jsonFunctionRegex.exec(string);
      if (functionMatches) {
        currentIndex += functionMatches[0].indexOf('(');
        hasJsonFunction = true;
        continue;
      }

      const tokenMatches = tokenCaptureRegex.exec(string);
      if (tokenMatches) {
        const capturedToken = tokenMatches[1];
        if (capturedToken === '(') {
          openingBrackets++;
        } else if (capturedToken === ')') {
          closingBrackets++;
        } else if (capturedToken === ';') {
          hasInvalidToken = true;
          break;
        }
        currentIndex += tokenMatches[0].length;
        continue;
      }

      break;
    }

    // Check invalid json statement
    hasInvalidToken |= openingBrackets !== closingBrackets;
    if (hasJsonFunction && hasInvalidToken) {
      throw new Error(`Invalid json statement: ${stmt}`);
    }

    // return true if the statement has valid json function
    return hasJsonFunction;
  }

  //sqlite can't cast to datetime so we need to convert date values to their ISO strings
  _toJSONValue(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value) && value[0] instanceof Date) {
      return value.map(val => val.toISOString());
    }
    return value;
  }


  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    if (smth instanceof Utils.Json) {
      // Parse nested object
      if (smth.conditions) {
        const conditions = this.parseConditionObject(smth.conditions).map(condition =>
          new Composition(this.jsonPathExtractionQuery(condition.path[0], _.tail(condition.path), tableName), ' = ', new Slot(condition.value))
        );

        return CompositionGroup.from(conditions).space(' AND ').toComposition();
      }
      if (smth.path) {
        const composition = new Composition();

        // Allow specifying conditions using the sqlite json functions
        if (this._checkValidJsonStatement(smth.path)) {
          composition.add(smth.path);
        } else {
          // Also support json property accessors
          const paths = _.toPath(smth.path);
          const column = paths.shift();
          composition.add(this.jsonPathExtractionQuery(column, paths, tableName));
        }

        if (smth.value) {
          if (smth.value instanceof Utils.SequelizeMethod) {
            return composition.add(' = ', this.handleSequelizeMethod(smth.value));
          }

          return composition.add(' = ', new Slot(smth.value));
        }

        return composition;
      }
    } else if (smth instanceof Utils.Cast) {
      if (/timestamp/i.test(smth.type)) {
        smth.type = 'datetime';
      }
    }

    return AbstractQueryGenerator.prototype.handleSequelizeMethod.call(this, smth, tableName, factory, options, prepend);
  }

  addColumnQuery(table, key, dataType) {
    const attributes = {};
    attributes[key] = dataType;
    const fields = this.attributesToSQL(attributes, { context: 'addColumn' });
    const attribute = `${this.quoteIdentifier(key)} ${fields[key]}`;

    const sql = `ALTER TABLE ${this.quoteTable(table)} ADD ${attribute};`;

    return this.replaceBooleanDefaults(sql);
  }

  showTablesQuery() {
    return 'SELECT name FROM `sqlite_master` WHERE type=\'table\' and name!=\'sqlite_sequence\';';
  }

  truncateTableQuery(tableName) {
    return `DELETE FROM ${this.quoteTable(tableName)}`;
  }

  deleteQuery(tableName, where, options = {}, model) {
    _.defaults(options, this.options);

    const composition = new Composition();
    const whereClause = new Composition(this.getWhereConditions(where, null, model, options));
    composition.add('DELETE FROM ', this.quoteTable(tableName));

    if (whereClause.length) whereClause.prepend(' WHERE ');

    if (options.limit) {
      whereClause.set(' WHERE rowid IN (SELECT rowid FROM ', this.quoteTable(tableName),
        whereClause, ' LIMIT ', new Slot(options.limit), ')');
    }

    composition.add(whereClause);

    return composition;
  }

  attributesToSQL(attributes) {
    const result = {};

    for (const name in attributes) {
      const attr = attributes[name];
      const fieldName = attr.field || name;

      if (_.isObject(attr)) {
        let sql = attr.type.toString();

        if (attr.hasOwnProperty('allowNull') && !attr.allowNull) {
          sql += ' NOT NULL';
        }

        if (Utils.defaultValueSchemable(attr.defaultValue)) {
          // TODO thoroughly check that DataTypes.NOW will properly
          // get populated on all databases as DEFAULT value
          // i.e. mysql requires: DEFAULT CURRENT_TIMESTAMP
          sql += ` DEFAULT ${this.escape(attr.defaultValue, attr)}`;
        }

        if (attr.unique === true) {
          sql += ' UNIQUE';
        }

        if (attr.primaryKey) {
          sql += ' PRIMARY KEY';

          if (attr.autoIncrement) {
            sql += ' AUTOINCREMENT';
          }
        }

        if (attr.references) {
          const referencesTable = this.quoteTable(attr.references.model);

          let referencesKey;
          if (attr.references.key) {
            referencesKey = this.quoteIdentifier(attr.references.key);
          } else {
            referencesKey = this.quoteIdentifier('id');
          }

          sql += ` REFERENCES ${referencesTable} (${referencesKey})`;

          if (attr.onDelete) {
            sql += ` ON DELETE ${attr.onDelete.toUpperCase()}`;
          }

          if (attr.onUpdate) {
            sql += ` ON UPDATE ${attr.onUpdate.toUpperCase()}`;
          }

        }

        result[fieldName] = sql;
      } else {
        result[fieldName] = attr;
      }
    }

    return result;
  }

  showIndexesQuery(tableName) {
    return `PRAGMA INDEX_LIST(${this.quoteTable(tableName)})`;
  }

  showConstraintsQuery(tableName, constraintName) {
    let sql = `SELECT sql FROM sqlite_master WHERE tbl_name='${tableName}'`;

    if (constraintName) {
      sql += ` AND sql LIKE '%${constraintName}%'`;
    }

    return `${sql};`;
  }

  removeIndexQuery(tableName, indexNameOrAttributes) {
    let indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(`${tableName}_${indexNameOrAttributes.join('_')}`);
    }

    return `DROP INDEX IF EXISTS ${this.quoteIdentifier(indexName)}`;
  }

  describeTableQuery(tableName, schema, schemaDelimiter) {
    const table = {
      _schema: schema,
      _schemaDelimiter: schemaDelimiter,
      tableName
    };
    return `PRAGMA TABLE_INFO(${this.quoteTable(this.addSchema(table))});`;
  }

  describeCreateTableQuery(tableName) {
    return `SELECT sql FROM sqlite_master WHERE tbl_name='${tableName}';`;
  }

  removeColumnQuery(tableName, attributes) {

    attributes = this.attributesToSQL(attributes);

    let backupTableName;
    if (typeof tableName === 'object') {
      backupTableName = {
        tableName: `${tableName.tableName}_backup`,
        schema: tableName.schema
      };
    } else {
      backupTableName = `${tableName}_backup`;
    }

    const quotedTableName = this.quoteTable(tableName);
    const quotedBackupTableName = this.quoteTable(backupTableName);
    const attributeNames = Object.keys(attributes).map(attr => this.quoteIdentifier(attr)).join(', ');

    // Temporary table cannot work for foreign keys.
    return `${this.createTableQuery(backupTableName, attributes)
    }INSERT INTO ${quotedBackupTableName} SELECT ${attributeNames} FROM ${quotedTableName};`
      + `DROP TABLE ${quotedTableName};${
        this.createTableQuery(tableName, attributes)
      }INSERT INTO ${quotedTableName} SELECT ${attributeNames} FROM ${quotedBackupTableName};`
      + `DROP TABLE ${quotedBackupTableName};`;
  }

  _alterConstraintQuery(tableName, attributes, createTableSql) {
    let backupTableName;

    attributes = this.attributesToSQL(attributes);

    if (typeof tableName === 'object') {
      backupTableName = {
        tableName: `${tableName.tableName}_backup`,
        schema: tableName.schema
      };
    } else {
      backupTableName = `${tableName}_backup`;
    }
    const quotedTableName = this.quoteTable(tableName);
    const quotedBackupTableName = this.quoteTable(backupTableName);
    const attributeNames = Object.keys(attributes).map(attr => this.quoteIdentifier(attr)).join(', ');

    return `${createTableSql.replace(`CREATE TABLE ${quotedTableName}`, `CREATE TABLE ${quotedBackupTableName}`)
    }INSERT INTO ${quotedBackupTableName} SELECT ${attributeNames} FROM ${quotedTableName};`
      + `DROP TABLE ${quotedTableName};`
      + `ALTER TABLE ${quotedBackupTableName} RENAME TO ${quotedTableName};`;
  }

  renameColumnQuery(tableName, attrNameBefore, attrNameAfter, attributes) {

    let backupTableName;

    attributes = this.attributesToSQL(attributes);

    if (typeof tableName === 'object') {
      backupTableName = {
        tableName: `${tableName.tableName}_backup`,
        schema: tableName.schema
      };
    } else {
      backupTableName = `${tableName}_backup`;
    }

    const quotedTableName = this.quoteTable(tableName);
    const quotedBackupTableName = this.quoteTable(backupTableName);
    const attributeNamesImport = Object.keys(attributes).map(attr =>
      attrNameAfter === attr ? `${this.quoteIdentifier(attrNameBefore)} AS ${this.quoteIdentifier(attr)}` : this.quoteIdentifier(attr)
    ).join(', ');
    const attributeNamesExport = Object.keys(attributes).map(attr => this.quoteIdentifier(attr)).join(', ');

    return `${this.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE')
    }INSERT INTO ${quotedBackupTableName} SELECT ${attributeNamesImport} FROM ${quotedTableName};`
      + `DROP TABLE ${quotedTableName};${
        this.createTableQuery(tableName, attributes)
      }INSERT INTO ${quotedTableName} SELECT ${attributeNamesExport} FROM ${quotedBackupTableName};`
      + `DROP TABLE ${quotedBackupTableName};`;
  }

  startTransactionQuery(transaction) {
    if (transaction.parent) {
      return `SAVEPOINT ${this.quoteIdentifier(transaction.name)};`;
    }

    return `BEGIN ${transaction.options.type} TRANSACTION;`;
  }

  setIsolationLevelQuery(value) {
    switch (value) {
      case Transaction.ISOLATION_LEVELS.REPEATABLE_READ:
        return '-- SQLite is not able to choose the isolation level REPEATABLE READ.';
      case Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED:
        return 'PRAGMA read_uncommitted = ON;';
      case Transaction.ISOLATION_LEVELS.READ_COMMITTED:
        return 'PRAGMA read_uncommitted = OFF;';
      case Transaction.ISOLATION_LEVELS.SERIALIZABLE:
        return '-- SQLite\'s default isolation level is SERIALIZABLE. Nothing to do.';
      default:
        throw new Error(`Unknown isolation level: ${value}`);
    }
  }

  replaceBooleanDefaults(sql) {
    return sql.replace(/DEFAULT '?false'?/g, 'DEFAULT 0').replace(/DEFAULT '?true'?/g, 'DEFAULT 1');
  }

  /**
   * Generates an SQL query that returns all foreign keys of a table.
   *
   * @param  {string} tableName  The name of the table.
   * @returns {string}            The generated sql query.
   * @private
   */
  getForeignKeysQuery(tableName) {
    return `PRAGMA foreign_key_list(${tableName})`;
  }

  bindParam(bind) {
    return value => {
      bind.push(value);
      return `?${bind.length}`;
    };
  }
};

module.exports = SQLiteQueryGenerator;
