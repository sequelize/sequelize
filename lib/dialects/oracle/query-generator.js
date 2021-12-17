'use strict';

/* jshint -W110 */
const Utils = require('../../utils');
const DataTypes = require('../../data-types');
const AbstractQueryGenerator = require('../abstract/query-generator');
const _ = require('lodash');
const crc32 = require('js-crc').crc32;
const uuid = require('uuid');

class OracleQueryGenerator extends AbstractQueryGenerator {
  constructor(options) {
    super(options);
    this.oracleReservedWords = [
      'ACCESS',
      'ADD',
      'ALL',
      'ALTER',
      'AND',
      'ANY',
      'ARRAYLEN',
      'AS',
      'ASC',
      'AUDIT',
      'BETWEEN',
      'BY',
      'CHAR',
      'CHECK',
      'CLUSTER',
      'COLUMN',
      'COMMENT',
      'COMPRESS',
      'CONNECT',
      'CREATE',
      'CURRENT',
      'DATE',
      'DECIMAL',
      'DEFAULT',
      'DELETE',
      'DESC',
      'DISTINCT',
      'DROP',
      'ELSE',
      'EXCLUSIVE',
      'EXISTS',
      'FILE',
      'FLOAT',
      'FOR',
      'FROM',
      'GRANT',
      'GROUP',
      'HAVING',
      'IDENTIFIED',
      'IMMEDIATE',
      'IN',
      'INCREMENT',
      'INDEX',
      'INITIAL',
      'INSERT',
      'INTEGER',
      'INTERSECT',
      'INTO',
      'IS',
      'LEVEL',
      'LIKE',
      'LOCK',
      'LONG',
      'MAXEXTENTS',
      'MINUS',
      'MODE',
      'MODIFY',
      'NOAUDIT',
      'NOCOMPRESS',
      'NOT',
      'NOTFOUND',
      'NOWAIT',
      'NULL',
      'NUMBER',
      'OF',
      'OFFLINE',
      'ON',
      'ONLINE',
      'OPTION',
      'OR',
      'ORDER',
      'PCTFREE',
      'PRIOR',
      'PRIVILEGES',
      'PUBLIC',
      'RAW',
      'RENAME',
      'RESOURCE',
      'REVOKE',
      'ROW',
      'ROWID',
      'ROWLABEL',
      'ROWNUM',
      'ROWS',
      'SELECT',
      'SESSION',
      'SET',
      'SHARE',
      'SIZE',
      'SMALLINT',
      'SQLBUF',
      'START',
      'SUCCESSFUL',
      'SYNONYM',
      'SYSDATE',
      'TABLE',
      'THEN',
      'TO',
      'TRIGGER',
      'UID',
      'UNION',
      'UNIQUE',
      'UPDATE',
      'USER',
      'VALIDATE',
      'VALUES',
      'VARCHAR',
      'VARCHAR2',
      'VIEW',
      'WHENEVER',
      'WHERE',
      'WITH',
    ];
  }

  createSchema(schema) {
    let tempSchema = schema;
    schema = this.quoteIdentifier(schema);
    if (tempSchema === schema) {
      schema = schema.toUpperCase();
    }
    return [
      'DECLARE',
      '  V_COUNT INTEGER;',
      '  V_CURSOR_NAME INTEGER;',
      '  V_RET INTEGER;',
      'BEGIN',
      '  SELECT COUNT(1) INTO V_COUNT FROM ALL_USERS WHERE USERNAME = ',
      wrapSingleQuote(schema),
      ';',
      '  IF V_COUNT = 0 THEN',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('CREATE USER ' + schema + ' IDENTIFIED BY 12345 DEFAULT TABLESPACE USERS'),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT "CONNECT" TO ' + schema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create table TO ' + schema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create view TO ' + schema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create any trigger TO ' + schema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create any procedure TO ' + schema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create sequence TO ' + schema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create synonym TO ' + schema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('ALTER USER ' + schema + ' QUOTA UNLIMITED ON USERS'),
      ';',
      '  END IF;',
      'END;'
    ].join(' ');
  }

  showSchemasQuery() {
    return 'SELECT USERNAME AS "schema_name" FROM ALL_USERS WHERE COMMON = (\'NO\') AND USERNAME != user';
  }

  dropSchema(schemaName) {
    let tempSchemaName = schemaName;
    schemaName = this.quoteIdentifier(schemaName);
    if (tempSchemaName === schemaName) {
      schemaName = schemaName.toUpperCase();
    }
    return [
      'DECLARE',
      '  V_COUNT INTEGER;',
      'BEGIN',
      '  V_COUNT := 0;',
      '  SELECT COUNT(1) INTO V_COUNT FROM ALL_USERS WHERE USERNAME = ',
      wrapSingleQuote(schemaName),
      ';',
      '  IF V_COUNT != 0 THEN',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('DROP USER ' + schemaName + ' CASCADE'),
      ';',
      '  END IF;',
      'END;'
    ].join(' ')
  }
  versionQuery() {
    return "SELECT VERSION FROM PRODUCT_COMPONENT_VERSION WHERE PRODUCT LIKE 'Oracle%'";
  }

  createTableQuery(tableName, attributes, options) {
    let query = 'CREATE TABLE <%= table %> (<%= attributes %>)';
    const completeQuery =
        "BEGIN EXECUTE IMMEDIATE '<%= createTableQuery %>'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;",
      self = this;
    const primaryKeys = [],
      foreignKeys = {},
      attrStr = [],
      checkStr = [];

    const values = {
      table: this.quoteTable(tableName)
    };

    const regex = /REFERENCES ([a-zA-Z_.0-9]*) \((.*)\)/g; //Global regex
    const chkRegex = /CHECK \(([a-zA-Z_.0-9]*) (.*)\)/g; //Check regex

    //Starting by dealing with all attributes
    for (let attr in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, attr)) {
        const dataType = attributes[attr];
        let match;

        attr = this.quoteIdentifier(attr);

        // ORACLE doesn't support inline REFERENCES declarations: move to the end
        if (_.includes(dataType, 'PRIMARY KEY')) {
          //Primary key
          primaryKeys.push(attr);
          if (_.includes(dataType, 'REFERENCES')) {
            match = dataType.match(/^(.+) (REFERENCES.*)$/);
            attrStr.push(attr + ' ' + match[1].replace(/PRIMARY KEY/, ''));

            foreignKeys[attr] = match[2].replace(regex, (match, table, column) => {
              //We don't want the table name to be quoted if we pass the schema name
              let tableName = '';
              if (_.isPlainObject(table)) {
                if (table.schema) {
                  tableName = this.quoteTable(table.schema) + '.';
                }
                tableName += this.quoteTable(table.tableName);
              } else {
                tableName = _.includes(this.oracleReservedWords, table.toUpperCase()) ? '"' + table + '"' : table;
              }

              return `REFERENCES ${tableName} (${this.quoteIdentifier(column)})`;
            });
          } else {
            attrStr.push(attr + ' ' + dataType.replace(/PRIMARY KEY/, '').trim());
          }
        } else if (_.includes(dataType, 'REFERENCES')) {
          //Foreign key
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(attr + ' ' + match[1]);

          foreignKeys[attr] = match[2].replace(regex, (match, table, column) => {
            //We don't want the table name to be quoted if we pass the schema name
            let tableName = '';
            if (_.isPlainObject(table)) {
              if (table.schema) {
                tableName = this.quoteTable(table.schema) + '.';
              }
              tableName += this.quoteTable(table.tableName);
            } else {
              tableName = _.includes(this.oracleReservedWords, table.toUpperCase()) ? '"' + table + '"' : table;
            }
            return `REFERENCES ${tableName} (${this.quoteIdentifier(column)})`;
          });
        } else if (_.includes(dataType, 'CHECK')) {
          //Check constraints go to the end
          match = dataType.match(/^(.+) (CHECK.*)$/);
          attrStr.push(attr + ' ' + match[1]);
          match[2] = match[2].replace('ATTRIBUTENAME', attr);
          const checkCond = match[2].replace(chkRegex, (match, column, condition) => {
            return `CHECK (${this.quoteIdentifier(column)} ${condition})`;
          });

          checkStr.push(checkCond);
        } else {
          attrStr.push(attr + ' ' + dataType);
        }
      }
    }

    values['attributes'] = attrStr.join(', ');

    const pkString = primaryKeys
      .map(
        (pk => {
          return this.quoteIdentifier(pk);
        }).bind(this)
      )
      .join(', ');

    if (pkString.length > 0) {
      let primaryKeyName = `PK${values.table}${pkString}`.replace(/[.,"\s]/g, ''); //We replace the space if there are multiple columns

      //Oracle doesn't support names with more that 32 characters, so we replace it by PK CRC32
      if (primaryKeyName.length > 30) {
        primaryKeyName = `PK${values.table}${crc32(pkString)}`.replace(/[.,"\s]/g, '');
        if (primaryKeyName.length > 30) {
          const crcName = crc32(`${values.table}_${pkString}`);
          primaryKeyName = `PK${crcName}`.replace(/[.,"\s]/g, '');
        }
      }

      values.attributes += ',CONSTRAINT ' + primaryKeyName + ' PRIMARY KEY (' + pkString + ')';
    }

    //Dealing with FKs
    for (const fkey in foreignKeys) {
      if (Object.prototype.hasOwnProperty.call(foreignKeys, fkey)) {
        //Oracle default response for FK, doesn't support if defined
        if (foreignKeys[fkey].indexOf('ON DELETE NO ACTION') > -1) {
          foreignKeys[fkey] = foreignKeys[fkey].replace('ON DELETE NO ACTION', '');
        }

        let fkName = `FK${values.table}${fkey}`.replace(/[."]/g, '');
        //Oracle doesn't support names with more that 32 characters, so we replace it by FK CRC(columns)
        if (fkName.length > 30) {
          fkName = `FK${values.table}${crc32(fkey)}`.replace(/[."]/g, '');
          //If the name is still too long (table name very long), we generate only FK CRC(table_columns)
          if (fkName.length > 30) {
            const crcName = crc32(`${values.table}_${fkey}`);
            fkName = `FK${crcName}`.replace(/[."]/g, '');
          }
        }

        values.attributes +=
          ',CONSTRAINT ' + fkName + ' FOREIGN KEY (' + this.quoteIdentifier(fkey) + ') ' + foreignKeys[fkey];
      }
    }

    if (checkStr.length > 0) {
      values.attributes += ', ' + checkStr.join(', ');
    }

    //Specific case for unique indexes with Oracle, we have to set the constraint on the column, if not, no FK will be possible (ORA-02270: no matching unique or primary key for this column-list)
    if (options && options.indexes && options.indexes.length > 0) {
      const idxToDelete = [];
      options.indexes.forEach((index, idx) => {
        if ('unique' in index && (index.unique === true || (index.unique.length > 0 && index.unique !== false))) {
          //If unique index, transform to unique constraint on column
          const fields = index.fields.map(field => {
            if (typeof field === 'string') {
              return field;
            } else {
              return field.attribute;
            }
          });

          //Now we have to be sure that the constraint isn't already declared in uniqueKeys
          let canContinue = true;
          if (options.uniqueKeys) {
            const keys = Object.keys(options.uniqueKeys);

            for (let fieldIdx = 0; fieldIdx < keys.length; fieldIdx++) {
              const currUnique = options.uniqueKeys[keys[fieldIdx]];

              if (currUnique.fields.length === fields.length) {
                //lengths are the same, possible same constraint
                for (let i = 0; i < currUnique.fields.length; i++) {
                  const field = currUnique.fields[i];

                  if (_.includes(fields, field)) {
                    canContinue = false;
                  } else {
                    //We have at least one different column, even if we found the same columns previously, we let the constraint be created
                    canContinue = true;
                    break;
                  }
                }
              }
            }

            if (canContinue) {
              let indexName = 'name' in index ? index.name : '';

              if (indexName === '' || indexName.length > 30) {
                indexName = this._generateUniqueConstraintName(values.table, fields);
              }
              const constraintToAdd = {
                name: indexName,
                fields
              };
              if (!('uniqueKeys' in options)) {
                options.uniqueKeys = {};
              }

              options.uniqueKeys[indexName] = constraintToAdd;
              idxToDelete.push(idx);
            } else {
              //The constraint already exists, we remove it from the list
              idxToDelete.push(idx);
            }
          }
        }
      });
      idxToDelete.forEach(idx => {
        options.indexes.splice(idx, 1);
      });
    }

    if (options && !!options.uniqueKeys) {
      _.each(options.uniqueKeys, (columns, indexName) => {
        let canBeUniq = false;

        //Check if we can create the unique key
        primaryKeys.forEach(primaryKey => {
          //We can create an unique constraint if it's not on the primary key AND if it doesn't have unique in its definition

          if (!_.includes(columns.fields, primaryKey)) {
            canBeUniq = true;
          }
        });

        columns.fields.forEach(field => {
          let currField = '';
          if (!_.isString(field)) {
            currField = field.attribute.replace(/[.,"\s]/g, '');
          } else {
            currField = field.replace(/[.,"\s]/g, '');
          }
          if (currField in attributes) {
            if (attributes[currField].toUpperCase().indexOf('UNIQUE') > -1) {
              //We generate the attribute without UNIQUE
              const attrToReplace = attributes[currField].replace('UNIQUE', '');
              //We replace in the final string
              values.attributes = values.attributes.replace(attributes[currField], attrToReplace);
            }
          }
        });

        //Oracle cannot have an unique AND a primary key on the same fields, prior to the primary key
        if (canBeUniq) {
          if (!_.isString(indexName)) {
            indexName = this._generateUniqueConstraintName(values.table, columns.fields);
          }

          //Oracle doesn't support names with more that 32 characters, so we replace it by PK timestamp
          if (indexName.length > 30) {
            indexName = this._generateUniqueConstraintName(values.table, columns.fields);
          }

          const indexUpperName = indexName.toUpperCase();

          if (_.includes(this.oracleReservedWords, indexUpperName) || indexUpperName.charAt(0) === '_') {
            indexName = '"' + indexName + '"';
          }

          const index = options.uniqueKeys[columns.name];
          delete options.uniqueKeys[columns.name];
          indexName = indexName.replace(/[.,\s]/g, '');
          columns.name = indexName;
          options.uniqueKeys[indexName] = index;
          values.attributes +=
            ', CONSTRAINT ' + indexName + ' UNIQUE (' + columns.fields.map(field => self.quoteIdentifier(field)).join(', ') + ')';
        }
      });
    }

    query = _.template(query)(values).trim();
    //we replace single quotes by two quotes in order for the execute statement to work
    query = query.replace(/'/g, "''");
    values.createTableQuery = query;

    return _.template(completeQuery)(values).trim();
  }

  /**
   * Generates a name for an unique constraint with the pattern : uniqTABLENAMECOLUMNNAMES
   * If this indexName is too long for Oracle, it's hashed to have an acceptable length
   *
   * @param table
   * @param columns
   */
  _generateUniqueConstraintName(table, columns) {
    let indexName = `uniq${table}${columns.join('')}`.replace(/[.,"\s]/g, '').toLowerCase();

    //Oracle doesn't support names with more that 32 characters, so we replace it by PK timestamp
    if (indexName.length > 30) {
      indexName = `uniq${table}${crc32(columns.join(''))}`.replace(/[.,"\s]/g, '').toLowerCase();

      if (indexName.length > 30) {
        const crcName = crc32(`${table}_${columns.join('')}`);
        indexName = `uniq${crcName}`.replace(/[.,"\s]/g, '').toLowerCase();
      }
    }

    return indexName;
  }
  describeTableQuery(tableName, schema) {
    //name, type, datalength (except number / nvarchar), datalength varchar, datalength number, nullable, default value, primary ?
    const sql = [
      'SELECT atc.COLUMN_NAME, atc.DATA_TYPE, atc.DATA_LENGTH, atc.CHAR_LENGTH, atc.DEFAULT_LENGTH, atc.NULLABLE, ',
      "CASE WHEN ucc.CONSTRAINT_NAME  LIKE'%PK%' THEN 'PRIMARY' ELSE '' END AS \"PRIMARY\" ",
      'FROM all_tab_columns atc ',
      'LEFT OUTER JOIN all_cons_columns ucc ON(atc.table_name = ucc.table_name AND atc.COLUMN_NAME = ucc.COLUMN_NAME ) ',
      schema
        ? "WHERE (atc.OWNER=UPPER('<%= schema %>') OR atc.OWNER='<%= schema %>') "
        : 'WHERE atc.OWNER=(SELECT USER FROM DUAL) ',
      "AND (atc.TABLE_NAME=UPPER('<%= tableName %>') OR atc.TABLE_NAME='<%= tableName %>')",
      'ORDER BY "PRIMARY", atc.COLUMN_NAME'
    ].join('');

    const currTableName = _.isPlainObject(tableName) ? tableName.tableName : tableName;

    const values = {
      tableName: currTableName,
      schema
    };

    return _.template(sql)(values).trim();
  }

  renameTableQuery(before, after) {
    const query = 'ALTER TABLE <%= before %> RENAME TO <%= after %>';
    return _.template(query)({
      before: this.quoteTable(before),
      after: this.quoteTable(after)
    });
  }

  showConstraintsQuery(tableName) {
    return `SELECT CONSTRAINT_NAME constraint_name FROM user_cons_columns WHERE table_name = '${tableName.toUpperCase()}'`;
  }

  showTablesQuery() {
    return 'SELECT owner as table_schema, table_name, 0 as lvl FROM all_tables where OWNER IN(SELECT USERNAME AS "schema_name" FROM ALL_USERS WHERE ORACLE_MAINTAINED = \'N\')';
  }

  dropTableQuery(tableName) {
    let table = '';
    table = this.quoteTable(tableName);

    const query = [
      'BEGIN ',
      "EXECUTE IMMEDIATE 'DROP TABLE <%= table %> CASCADE CONSTRAINTS PURGE';",
      ' EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN',
      ' RAISE; END IF;',
      'END;'
    ];

    const values = {
      table
    };

    return _.template(query.join(''))(values).trim();
  }

  addConstraintQuery(tableName, options) {
    options = options || {};

    const constraintSnippet = this.getConstraintSnippet(tableName, options);

    if (typeof tableName === 'string') {
      tableName = this.quoteIdentifiers(tableName);
    } else {
      tableName = this.quoteTable(tableName);
    }

    return `ALTER TABLE ${tableName} ADD ${constraintSnippet};`;
  }

  addColumnQuery(table, key, dataType) {
    dataType.field = key;

    const query = 'ALTER TABLE <%= table %> ADD (<%= attribute %>)',
      attribute = _.template('<%= key %> <%= definition %>')({
        key: this.quoteIdentifier(key),
        definition: this.attributeToSQL(dataType, {
          context: 'addColumn'
        })
          .replace('ATTRIBUTENAME', key)
          .replace(/'/g, "'")
      });

    return _.template(query)({
      table: this.quoteTable(table),
      attribute
    });
  }

  removeColumnQuery(tableName, attributeName) {
    return Utils.joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP COLUMN',
      this.quoteIdentifier(attributeName),
      ';'
    ]);
  }

  changeColumnQuery(tableName, attributes) {
    const modifyQuery = 'ALTER TABLE <%= tableName %> MODIFY (<%= query %>)';
    const alterQuery = 'ALTER TABLE <%= tableName %> <%= query %>';
    let query = '';
    const attrString = [],
      constraintString = [];

    for (const attributeName in attributes) {
      let definition = attributes[attributeName];
      if (definition.match(/REFERENCES/)) {
        constraintString.push(
          _.template('<%= fkName %> FOREIGN KEY (<%= attrName %>) <%= definition %>')({
            fkName: attributeName + '_foreign_idx',
            attrName: attributeName,
            definition: definition.replace(/.+?(?=REFERENCES)/, '')
          })
        );
      } else {
        if (definition.indexOf('CHECK') > -1) {
          definition = definition.replace(/'/g, "''");
        }
        attrString.push(
          _.template('<%= attrName %> <%= definition %>')({
            attrName: attributeName,
            definition
          })
        );
      }
    }

    let fullQuery =
      'BEGIN ' +
      "EXECUTE IMMEDIATE '<%= fullQuery %>';" +
      ' EXCEPTION' +
      ' WHEN OTHERS THEN' +
      ' IF SQLCODE = -1442 OR SQLCODE = -1451 THEN' +
      " EXECUTE IMMEDIATE '<%= secondQuery %>';" + //We execute the statement without the NULL / NOT NULL clause if the first statement failed due to this
      ' ELSE' +
      ' RAISE;' +
      ' END IF;' +
      ' END;';

    let finalQuery = '';
    if (attrString.length) {
      finalQuery += attrString.join(', ');
      finalQuery += constraintString.length ? ' ' : '';
    }
    if (constraintString.length) {
      finalQuery += 'ADD CONSTRAINT ' + constraintString.join(', ');
      //Here, we don't use modify
      query = alterQuery;
    } else {
      query = modifyQuery;
    }

    query = _.template(query)({
      tableName: this.quoteTable(tableName),
      query: finalQuery
    });

    //Oracle doesn't support if we try to define a NULL / NOT NULL column if it is already in this case
    //see https://docs.oracle.com/cd/B28359_01/server.111/b28278/e900.htm#ORA-01451
    const secondQuery = query.replace('NOT NULL', '').replace('NULL', '');

    return (fullQuery = _.template(fullQuery)({
      fullQuery: query,
      secondQuery
    }));
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const query = 'ALTER TABLE <%= tableName %> RENAME COLUMN <%= before %> TO <%= after %>',
      newName = Object.keys(attributes)[0];

    return _.template(query)({
      tableName: this.quoteTable(tableName),
      before: this.quoteIdentifier(attrBefore),
      after: this.quoteIdentifier(newName)
    });
  }

  /**
   * Override of upsertQuery, Oracle specific
   * Using PL/SQL for finding the row
   *
   * @param tableName
   * @param insertValues
   * @param updateValues
   * @param where
   * @param model
   * @param options
   */
  upsertQuery(tableName, insertValues, updateValues, where, model, options) {
    const rawAttributes = model.rawAttributes;
    const sql = [
      'DECLARE ',
      'CURSOR findingRow IS ',
      `SELECT * FROM ${this.quoteTable(tableName)}`,
      where !== null && where !== undefined ? ' ' + this.whereQuery(where, options) : '',
      '; firstRow findingRow%ROWTYPE;',
      'BEGIN ',
      'OPEN findingRow; ',
      'FETCH findingRow INTO firstRow; ',
      'IF findingRow%FOUND THEN ',
      this.updateQuery(tableName, updateValues, where, options, rawAttributes),
      '; $:isUpdate;NUMBER$ := 2; ',
      'ELSE ',
      this.insertQuery(tableName, insertValues, rawAttributes, options),
      '; $:isUpdate;NUMBER$ := 1; ',
      'END IF; ',
      'CLOSE findingRow; ',
      'END;'
    ];

    return sql.join('');
  }

  /*
   * Override of insertQuery, Oracle specific
   */
  insertQuery(table, valueHash, modelAttributes, options) {
    options = options || {};
    _.defaults(options, this.options);

    const valueQuery = 'INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>)',
      emptyQuery = 'INSERT INTO <%= table %> VALUES (DEFAULT)',
      fields = [],
      values = [],
      primaryKeys = [],
      modelAttributeMap = {},
      realTableName = this.quoteTable(table),
      primaryKeyReturn = [];
    let key, query, value;

    //We have to specify a variable that will be used as return value for the id
    const returningQuery = '<%=valueQuery %> RETURNING <%=primaryKey %> INTO <%=primaryKeyReturn %>';

    if (modelAttributes) {
      //We search for the primaryKey
      const keys = Object.keys(modelAttributes);
      let idx = 0;

      while (idx < keys.length) {
        const AttributeKey = keys[idx];
        const modelAttribute = modelAttributes[AttributeKey];
        if (modelAttribute.primaryKey) {
          primaryKeys.push(modelAttribute);
        }
        idx++;
      }

      _.each(modelAttributes, (attribute, key) => {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    valueHash = Utils.removeNullValuesFromHash(valueHash, this.options.omitNull);
    for (key in valueHash) {
      if (Object.prototype.hasOwnProperty.call(valueHash, key)) {
        value = valueHash[key];
        fields.push(this.quoteIdentifier(key));

        if (modelAttributeMap && modelAttributeMap[key] && modelAttributeMap[key].autoIncrement === true && !value) {
          values.push('DEFAULT');
        } else {
          values.push(
            this.escape(value, (modelAttributeMap && modelAttributeMap[key]) || undefined, { context: 'INSERT' })
          );
        }
      }
    }

    let primaryKey = '';

    primaryKeys.forEach(element => {
      if (element.field.toLowerCase() === 'uid') {
        primaryKey += primaryKey.length > 0 ? ',"uid"' : '"uid"';

        const pkReturn = `$:pkReturnVal;${element.type.toSql()}$`;
        primaryKeyReturn.push(pkReturn);
      } else {
        primaryKey +=
          primaryKey.length > 0 ? ',' + this.quoteIdentifier(element.field) : this.quoteIdentifier(element.field);
        const pkReturn = `$:${element.field};${element.type.toSql()}$`;
        primaryKeyReturn.push(pkReturn);
      }
    });

    //If we want a return AND we haven't specified a primary key in the column list
    if (options.returning && primaryKey === '') {
      const tableKeys = Object.keys(this.sequelize.models);
      const currTableName = _.isPlainObject(table) ? table.tableName : table;

      const currentModelKey = tableKeys.find(modelKey => {
        return this.sequelize.models[modelKey].tableName === currTableName;
      });

      const currentModel = this.sequelize.models[currentModelKey];
      if ((!currentModel || !currentModel.hasPrimaryKeys) && modelAttributes) {
        //We don't have a primaryKey, so we will return the first column inserted
        let field = modelAttributes[Object.keys(modelAttributes)[0]].field;

        if (_.includes(this.oracleReservedWords, field.toUpperCase())) {
          //The column name we want to return is a reserved word, so we change it for the request to be OK
          field = 'pkReturnVal';
        }
        const pkReturn = `$:${field};string$`;
        primaryKey = this.quoteIdentifier(modelAttributes[Object.keys(modelAttributes)[0]].field);
        primaryKeyReturn.push(pkReturn);
      }
    }

    const replacements = {
      primaryKey,
      primaryKeyReturn: primaryKeyReturn.join(','),
      table: realTableName,
      attributes: fields.join(','),
      values: values.join(',')
    };

    if (options.returning && replacements.attributes && replacements.attributes.length > 0) {
      query = returningQuery;
      replacements.valueQuery = _.template(valueQuery)(replacements);
    } else {
      query = replacements.attributes.length ? valueQuery : emptyQuery;
    }

    return _.template(query)(replacements);
  }

  /**
   * Oracle way to insert multiple rows inside a single statement
   * INSERT ALL INSERT INTO table (column_name1,column_name2)
   * with row as (
   * SELECT value as "column_name1",value as "column_name2" FROM DUAL UNION ALL
   * SELECT value as "column_name1",value as "column_name2" FROM DUAL
   * )
   * SELECT * FROM row
   * Unfortunately, with version minor 11 and sequences, we can't use this, we have to chain multiple insert queries
   *
   * @param tableName
   * @param attrValueHashes
   * @param options
   * @param attributes
   */
  bulkInsertQuery(tableName, attrValueHashes, options, attributes) {
    const oracleDb = this._dialect.connectionManager.lib;
    const query =
        'INSERT ALL INTO <%= table %> (<%= attributes %>) WITH rowAttr AS (<%= rows %>) SELECT * FROM rowAttr;',
      emptyQuery = 'INSERT INTO <%= table %> (<%= attributes %>) VALUES (DEFAULT)',
      tuples = [],
      allAttributes = [];
    let allQueries = [];
    const inputParameters = {};
    let inputParamCpt = 0;

    // options.model.rawAttributes.memo.type; -> "TEXT"

    _.forEach(attrValueHashes, attrValueHash => {
      // special case for empty objects with primary keys
      const fields = Object.keys(attrValueHash);
      if (fields.length === 1 && attributes[fields[0]].autoIncrement && attrValueHash[fields[0]] === null) {
        allQueries.push(emptyQuery);
        return;
      }

      // normal case
      _.forOwn(attrValueHash, (value, key) => {
        if (allAttributes.indexOf(key) === -1) {
          if (value === null && attributes[key].autoIncrement) return;

          allAttributes.push(key);
        }
      });
    });

    //Loop over each row to insert
    if (allAttributes.length > 0) {
      //Loop over each attribute
      _.forEach(attrValueHashes, (attrValueHash, idx, array) => {
        //Generating the row
        let row = 'SELECT ';
        const attrs = allAttributes
          .map(key => {
            let currAttribute = key in options.model.rawAttributes ? options.model.rawAttributes[key] : null;

            if (currAttribute === null) {
              //Maybe we should find the attribute by field and not fieldName
              for (const attr in options.model.rawAttributes) {
                const attribute = options.model.rawAttributes[attr];
                if (attribute.field === key) {
                  currAttribute = attribute;
                  break;
                }
              }
            }
            if (
              (currAttribute && currAttribute.type.key === DataTypes.TEXT.key) ||
              currAttribute.type.key === DataTypes.BLOB.key
            ) {
              //If we try to insert into TEXT or BLOB, we need to pass by input-parameters to avoid the 4000 char length limit

              const paramName = `:input${key}${inputParamCpt}`;
              const inputParam = {
                dir: oracleDb.BIND_IN,
                val: attrValueHash[key]
              };
              //Binding type to parameter
              if (options.model.rawAttributes[key].type.key === DataTypes.TEXT.key) {
                //if text with length, it's generated as a String inside Oracle,
                if (options.model.rawAttributes[key].type._length !== '') {
                  inputParam['type'] = oracleDb.STRING;
                } else {
                  //No length -> it's a CLOB
                  inputParam['type'] = oracleDb.STRING;
                }
              } else {
                //No TEXT, it's a BLOB
                inputParam['type'] = oracleDb.BLOB;
              }
              inputParameters[paramName.slice(1, paramName.length)] = inputParam;
              return paramName + ' AS "' + key + '"';
            } else {
              return this.escape(attrValueHash[key]) + ' AS "' + key + '"';
            }
          })
          .join(',');
        row += attrs;
        row += idx < array.length - 1 ? ' FROM DUAL UNION ALL' : ' FROM DUAL';
        inputParamCpt++;
        tuples.push(row);
      });
      allQueries.push(query);
      if (Object.keys(inputParameters).length > 0) {
        options.inputParameters = inputParameters;
      }
    } else {
      //If we pass here, we don't have any attribute, just the id, so we take it to place it in the queries
      let queryToLaunch = "DECLARE x NUMBER := 0; BEGIN LOOP EXECUTE IMMEDIATE '";
      queryToLaunch += allQueries[0];
      queryToLaunch += "'; x:= x+1; IF x > ";
      queryToLaunch += allQueries.length - 1;
      queryToLaunch +=
        ' THEN EXIT; END IF; END LOOP; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;';

      allQueries = [queryToLaunch];
      allAttributes.push(Object.keys(attrValueHashes[0])[0]);
    }

    const replacements = {
      table: this.quoteTable(tableName),
      attributes: allAttributes
        .map(attr => {
          return this.quoteIdentifier(attr);
        })
        .join(','),
      rows: tuples.join(' ')
    };

    return _.template(allQueries.join(';'))(replacements);
  }

  truncateTableQuery(tableName) {
    return `TRUNCATE TABLE ${this.quoteTable(tableName)}`;
  }

  deleteQuery(tableName, where, options) {
    options = options || {};

    const table = tableName;

    where = this.getWhereConditions(where);
    const replacements = {
      table: this.quoteTable(table),
      limit: options.limit,
      where
    };

    let queryTmpl;
    // delete with limit <l> and optional condition <e> on Oracle: DELETE FROM <t> WHERE rowid in (SELECT rowid FROM <t> WHERE <e> AND rownum <= <l>)
    // Note that the condition <e> has to be in the subquery; otherwise, the subquery would select <l> arbitrary rows.
    if (options.limit) {
      const whereTmpl = where ? ' AND <%= where %>' : '';
      queryTmpl =
        'DELETE FROM <%= table %> WHERE rowid IN (SELECT rowid FROM <%= table %> WHERE rownum <= <%= limit %>' +
        whereTmpl +
        ')';
    } else {
      const whereTmpl = where ? ' WHERE <%= where %>' : '';
      queryTmpl = 'DELETE FROM <%= table %>' + whereTmpl;
    }

    return _.template(queryTmpl)(replacements);
  }

  showIndexesQuery(tableName) {
    let owner = '';

    if (_.isPlainObject(tableName)) {
      owner = tableName.schema;
      tableName = tableName.tableName;
    }

    const sql = [
      'SELECT i.index_name,i.table_name, i.column_name, u.uniqueness, i.descend ',
      'FROM all_ind_columns i ',
      'INNER JOIN all_indexes u ',
      'ON (u.table_name = i.table_name AND u.index_name = i.index_name) ',
      "WHERE (i.table_name = UPPER('<%= tableName %>') OR i.table_name = '<%= tableName %>')",
      owner.length > 0 ? " AND u.TABLE_OWNER = '" + this.getOwnerToGoodCase(owner) + "'" : '',
      ' ORDER BY INDEX_NAME, COLUMN_NAME'
    ];

    const request = sql.join('');
    return _.template(request)({
      tableName
    });
  }

  removeIndexQuery(tableName, indexNameOrAttributes) {
    const sql = 'DROP INDEX <%= indexName %>';
    let indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
    }

    const values = {
      tableName,
      indexName
    };

    return _.template(sql)(values);
  }

  attributeToSQL(attribute) {
    if (!_.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }
  
      //TODO: Address on update cascade issue whether to throw error or ignore.
      //[25/11/2021] Hasan - Add this to documentation when merging to sequelize-main
      //ON UPDATE CASCADE IS NOT SUPPORTED BY ORACLE.
    attribute.onUpdate = '';

    // handle self referential constraints
    if (attribute.references) {
      if (attribute.Model && attribute.Model.tableName === attribute.references.model) {
        this.sequelize.log(
          'Oracle does not support self referencial constraints, ' +
            'we will remove it but we recommend restructuring your query'
        );
        attribute.onDelete = '';
      }
    }

    let template;

    if (attribute.type instanceof DataTypes.ENUM) {
      if (attribute.type.values && !attribute.values) attribute.values = attribute.type.values;

      // enums are a special case
      template = attribute.type.toSql();
      template +=
        ' CHECK (ATTRIBUTENAME IN(' +
        _.map(attribute.values, value => {
          return this.escape(value);
        }).join(', ') +
        '))';
      return template;
    } else {
      if (attribute.autoIncrement) {
        template = ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY';
      } else {
        if (attribute.type && attribute.type.key === DataTypes.DOUBLE.key) {
          template = attribute.type.toSql();
        } else {
          if (attribute.type) {
            template = attribute.type.toString();
          } else {
            template = '';
          }
        }
      }
    }

    // Blobs/texts cannot have a defaultValue
    if (
      attribute.type &&
      attribute.type !== 'TEXT' &&
      attribute.type._binary !== true &&
      Utils.defaultValueSchemable(attribute.defaultValue)
    ) {
      template += ' DEFAULT ' + this.escape(attribute.defaultValue);
    }

    if (!attribute.autoIncrement) {
      //If autoincrement, not null is setted automatically
      if (attribute.allowNull === false) {
        template += ' NOT NULL';
      } else if (!attribute.primaryKey && !Utils.defaultValueSchemable(attribute.defaultValue)) {
        template += ' NULL';
      }
    }

    if (attribute.unique === true && !attribute.primaryKey) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.references) {
      template += ' REFERENCES ' + this.quoteTable(attribute.references.model);

      if (attribute.references.key) {
        template += ' (' + attribute.references.key + ')';
      } else {
        template += ' (' + 'id' + ')';
      }

      if (attribute.onDelete) {
        template += ' ON DELETE ' + attribute.onDelete.toUpperCase();
      }
    }

    return template;
  }
  attributesToSQL(attributes, options) {
    const result = {};

    for (const key in attributes) {
      const attribute = attributes[key];
      const attributeName = attribute.field || key;
      result[attributeName] = this.attributeToSQL(attribute, options).replace('ATTRIBUTENAME', attributeName);
    }

    return result;
  }

  createTrigger() {
    throwMethodUndefined('createTrigger');
  }

  dropTrigger() {
    throwMethodUndefined('dropTrigger');
  }

  renameTrigger() {
    throwMethodUndefined('renameTrigger');
  }

  createFunction() {
    throwMethodUndefined('createFunction');
  }

  dropFunction() {
    throwMethodUndefined('dropFunction');
  }

  renameFunction() {
    throwMethodUndefined('renameFunction');
  }

  /**
   * Method for setting the good case to the name passed in parameter used for defining the correct case for the owner
   * Method to use ONLY for parameters in SYSTEM TABLES ! (in this case, owner used to be uppercase, except if it's a reserved word)
   *
   * @param name
   */
  getOwnerToGoodCase(name) {
    if (_.includes(this.oracleReservedWords, name.toUpperCase())) {
      //The name is reserved, we return in normal case
      return name;
    } else {
      //The name is not reserved, we return in uppercase
      return name.toUpperCase();
    }
  }

  quoteIdentifier(identifier, force) {
    if (identifier === '*') {
      return identifier;
    }

    // Regex expression to check whether an indentifer is a valid oracle indentifier
    const regExp = (/^(([\w][\w\d_]*))$/g);
    if (force === true) {
      return Utils.addTicks(identifier, '"');
    } else if (_.includes(this.oracleReservedWords, identifier.toUpperCase())) {
      return Utils.addTicks(identifier, '"');
    } else if (regExp.test(identifier) === false) {
      return Utils.addTicks(identifier, '"');
    } else {
      return identifier;
    }
  }

  getConstraintsOnColumn(table, column) {
    const tableName = table.tableName || table;

    const sql = [
      "SELECT CONSTRAINT_NAME FROM user_cons_columns WHERE TABLE_NAME = '",
      tableName.toUpperCase(),
      "' ",
      table.schema ? " and OWNER = '" + this.getOwnerToGoodCase(table.schema) + "'" : '',
      " and COLUMN_NAME = '",
      column.toUpperCase(),
      "' AND POSITION IS NOT NULL ORDER BY POSITION"
    ].join('');

    return sql;
  }

  getForeignKeysQuery(table) {
    //We don't call quoteTable as we don't want the schema in the table name, Oracle seperates it on another field
    const tableName = table.tableName || table;
    const sql = [
      "select table_name,constraint_name, owner from all_constraints where constraint_type in ('U', 'R') and table_name = '",
      tableName.toUpperCase(),
      "'",
      table.schema ? " and owner = '" + this.getOwnerToGoodCase(table.schema) + "'" : '',
      ' order by table_name, constraint_name'
    ].join('');

    return sql;
  }

  quoteTable(param, as) {
    let table = '';

    if (_.isObject(param)) {
      if (param.schema) {
        table += this.quoteIdentifier(param.schema) + '.';
      }
      if (_.includes(this.oracleReservedWords, param.tableName.toUpperCase()) || param.tableName.indexOf('_') === 0) {
        table += this.quoteIdentifier(param.tableName, true);
      } else {
        table += this.quoteIdentifier(param.tableName);
      }
    } else {
      //If there is a reserved word, we have to quote it
      if (_.includes(this.oracleReservedWords, param.toUpperCase()) || param.indexOf('_') === 0) {
        table = this.quoteIdentifier(param, true);
      } else {
        table = this.quoteIdentifier(param);
      }
    }

    //Oracle don't support as for table aliases
    if (as) {
      if (as.indexOf('.') > -1 || as.indexOf('_') === 0) {
        table += ' ' + this.quoteIdentifier(as, true);
      } else {
        table += ' ' + this.quoteIdentifier(as);
      }
    }
    return table;
  }

  nameIndexes(indexes, rawTablename) {
    let tableName;
    if (_.isObject(rawTablename)) {
      tableName = rawTablename.schema + '.' + rawTablename.tableName;
    } else {
      tableName = rawTablename;
    }
    return _.map(indexes, index => {
      if (!Object.prototype.hasOwnProperty.call(index, 'name')) {
        if (index.unique) {
          index.name = this._generateUniqueConstraintName(tableName, index.fields);
        } else {
          const onlyAttributeNames = index.fields.map(field =>
            typeof field === 'string' ? field : field.name || field.attribute
          );
          index.name = Utils.underscore(tableName + '_' + onlyAttributeNames.join('_'));
        }
      }
      return index;
    });
  }

  dropForeignKeyQuery(tableName, foreignKey) {
    return this.dropConstraintQuery(tableName, foreignKey);
  }

  getPrimaryKeyConstraintQuery(tableName) {
    const sql = [
      'SELECT cols.column_name, atc.identity_column ',
      'FROM all_constraints cons, all_cons_columns cols ',
      'INNER JOIN all_tab_columns atc ON(atc.table_name = cols.table_name AND atc.COLUMN_NAME = cols.COLUMN_NAME )',
      "WHERE cols.table_name = '",
      tableName.tableName ? tableName.tableName.toUpperCase() : tableName.toUpperCase(),
      "' ",
      tableName.schema ? "AND cols.owner = '" + this.getOwnerToGoodCase(tableName.schema) + "' " : ' ',
      "AND cons.constraint_type = 'P' ",
      'AND cons.constraint_name = cols.constraint_name ',
      'AND cons.owner = cols.owner ',
      'ORDER BY cols.table_name, cols.position'
    ].join('');

    return sql;
  }

  /**
   * Request to know if the table has a identity primary key, returns the name of the declaration of the identity if true
   *
   * @param tableName
   */
  isIdentityPrimaryKey(tableName) {
    return [
      "SELECT TABLE_NAME,COLUMN_NAME, COLUMN_NAME,GENERATION_TYPE,IDENTITY_OPTIONS FROM DBA_TAB_IDENTITY_COLS WHERE TABLE_NAME='",
      tableName.tableName ? tableName.tableName.toUpperCase() : tableName.toUpperCase(),
      "' ",
      tableName.schema ? "AND OWNER = '" + this.getOwnerToGoodCase(tableName.schema) + "' " : ' '
    ].join('');
  }

  /**
   * Drop identity
   * Mandatory, Oracle doesn't support dropping a PK column if it's an identity -> results in database corruption
   *
   * @param tableName
   * @param columnName
   */
  dropIdentityColumn(tableName, columnName) {
    const table = this.quoteTable(tableName);

    return 'ALTER TABLE ' + table + ' MODIFY ' + columnName + ' DROP IDENTITY';
  }

  dropConstraintQuery(tableName, constraintName) {
    const sql = 'ALTER TABLE <%= table %> DROP CONSTRAINT "<%= constraint %>"';

    return _.template(sql)({
      table: this.quoteTable(tableName),
      constraint: constraintName
    });
  }

  setAutocommitQuery(value) {
    if (value) {
      //Do nothing, just for eslint
    }
    return '';
  }

  setIsolationLevelQuery(value, options) {
    if (options.parent) {
      return;
    }

    //We force the transaction level to the highest to have consistent datas
    return 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;';
  }

  generateTransactionId() {
    //Oracle doesn't support transaction names > 32...
    //To deal with -savepoint-XX , we generate the uuid and then get the crc32 of it
    return crc32(uuid.v4());
  }

  startTransactionQuery(transaction) {
    if (transaction.parent) {
      return 'SAVEPOINT "' + transaction.name + '"';
    }

    return 'BEGIN TRANSACTION';
  }

  commitTransactionQuery(transaction) {
    if (transaction.parent) {
      return;
    }

    return 'COMMIT TRANSACTION';
  }

  rollbackTransactionQuery(transaction) {
    if (transaction.parent) {
      return 'ROLLBACK TO SAVEPOINT "' + transaction.name + '"';
    }

    return 'ROLLBACK TRANSACTION';
  }

  selectFromTableFragment(options, model, attributes, tables, mainTableAs) {
    let mainFragment = 'SELECT ' + attributes.join(', ') + ' FROM ' + tables;

    if (mainTableAs) {
      mainFragment += ' ' + mainTableAs;
    }

    return mainFragment;
  }

  addLimitAndOffset(options, model) {
    let fragment = '';
    const offset = options.offset || 0,
      isSubQuery = options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation;

    let orders = {};
    if (options.order) {
      orders = this.getQueryOrders(options, model, isSubQuery);
    }

    if (options.limit || options.offset) {
      if (!(options.order && options.group) && (!options.order || (options.include && !orders.subQueryOrder.length))) {
        fragment += options.order && !isSubQuery ? ', ' : ' ORDER BY ';
        fragment += this.quoteTable(options.tableAs || model.name) + '.' + this.quoteIdentifier(model.primaryKeyField);
      }

      if (options.offset || options.limit) {
        fragment += ' OFFSET ' + this.escape(offset) + ' ROWS';
      }

      if (options.limit) {
        fragment += ' FETCH NEXT ' + this.escape(options.limit) + ' ROWS ONLY';
      }
    }

    return fragment;
  }

  booleanValue(value) {
    return value ? 1 : 0;
  }
}

// private methods
function wrapSingleQuote(identifier) {
  return Utils.addTicks(identifier, "'");
}

/* istanbul ignore next */
function throwMethodUndefined(methodName) {
  throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
}

function hasLowerCase(str) {
  return /[a-z]/.test(str);
}

module.exports = OracleQueryGenerator;
