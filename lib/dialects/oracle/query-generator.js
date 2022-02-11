'use strict';

/* jshint -W110 */
const Utils = require('../../utils');
const DataTypes = require('../../data-types');
const AbstractQueryGenerator = require('../abstract/query-generator');
const _ = require('lodash');
const util = require('util');
const Transaction = require('../../transaction');

class OracleQueryGenerator extends AbstractQueryGenerator {
  constructor(options) {
    super(options);
  }

  getCatalogName(value) {
    if (value) {
      if (this.options.quoteIdentifiers === false) {
        let quotedValue = this.quoteIdentifier(value);
        if (quotedValue === value) {
          value = value.toUpperCase();
        }
      }
    }
    return value;
  }

  getSchemaNameAndTableName(table) {
    let tableName = this.getCatalogName(table.tableName || table);
    let schemaName = this.getCatalogName(table.schema);
    return [tableName, schemaName];
  }

  createSchema(schema) {
    let quotedSchema = this.quoteTable(schema);
    let schemaName = this.getCatalogName(schema);
    return [
      'DECLARE',
      '  V_COUNT INTEGER;',
      '  V_CURSOR_NAME INTEGER;',
      '  V_RET INTEGER;',
      'BEGIN',
      '  SELECT COUNT(1) INTO V_COUNT FROM ALL_USERS WHERE USERNAME = ',
      wrapSingleQuote(schemaName),
      ';',
      '  IF V_COUNT = 0 THEN',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('CREATE USER ' + quotedSchema + ' IDENTIFIED BY 12345 DEFAULT TABLESPACE USERS'),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT "CONNECT" TO ' + quotedSchema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create table TO ' + quotedSchema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create view TO ' + quotedSchema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create any trigger TO ' + quotedSchema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create any procedure TO ' + quotedSchema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create sequence TO ' + quotedSchema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('GRANT create synonym TO ' + quotedSchema),
      ';',
      '    EXECUTE IMMEDIATE ',
      wrapSingleQuote('ALTER USER ' + quotedSchema + ' QUOTA UNLIMITED ON USERS'),
      ';',
      '  END IF;',
      'END;'
    ].join(' ');
  }

  showSchemasQuery() {
    return 'SELECT USERNAME AS "schema_name" FROM ALL_USERS WHERE COMMON = (\'NO\') AND USERNAME != user';
  }

  dropSchema(schema) {
    let schemaName = this.getCatalogName(schema);
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
      wrapSingleQuote('DROP USER ' + this.quoteTable(schema) + ' CASCADE'),
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

            // match[2] already has foreignKeys in correct format so we don't need to replace
            foreignKeys[attr] = match[2];
          } else {
            attrStr.push(attr + ' ' + dataType.replace(/PRIMARY KEY/, '').trim());
          }
        } else if (_.includes(dataType, 'REFERENCES')) {
          //Foreign key
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(attr + ' ' + match[1]);

          // match[2] already has foreignKeys in correct format so we don't need to replace
          foreignKeys[attr] = match[2];
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
      // PrimarykeyName would be of form "PK_table_col"
      // Since values.table and pkstring has quoted values we first replace "" with _
      // then we replace  [,"\s] with ''
      // If primary key name exceeds 128 then we let Oracle DB autogenerate the constraint name
      let primaryKeyName = `PK_${values.table}_${pkString}`.replace(/""/g, '_').replace(/[,"\s]/g, '');

      if (primaryKeyName.length > 128) {
        primaryKeyName = `PK_${values.table}`.replace(/""/g, '_').replace(/[,"\s]/g, '');
      }

      if (primaryKeyName.length > 128) {
        primaryKeyName = '';
      }

      if (primaryKeyName.length > 0) {
        values.attributes +=
        ',CONSTRAINT ' + this.quoteIdentifier(primaryKeyName) + ' PRIMARY KEY (' + pkString + ')';
      } else {
        values.attributes +=  ',PRIMARY KEY (' + pkString + ')';
      }
      
    }

    //Dealing with FKs
    for (const fkey in foreignKeys) {
      if (Object.prototype.hasOwnProperty.call(foreignKeys, fkey)) {
        //Oracle default response for FK, doesn't support if defined
        if (foreignKeys[fkey].indexOf('ON DELETE NO ACTION') > -1) {
          foreignKeys[fkey] = foreignKeys[fkey].replace('ON DELETE NO ACTION', '');
        }
        values.attributes += ',FOREIGN KEY (' + this.quoteIdentifier(fkey) + ') ' + foreignKeys[fkey];
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

              if (indexName === '') {
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
          // We can create an unique constraint if it's not on the primary key AND if it doesn't have unique in its definition
          // We replace quotes in primary key with ''
          // Primary key would be a list with double quotes in it so we remove the double quotes
          primaryKey = primaryKey.replace(/"/g, '')

          // We check if the unique indexes are already a part of primary key or not
          // If it is not then we set canbeuniq to true and add a unique constraint to these fields.
          // Else we can ignore unique constraint on these
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
            // If canBeUniq is false we need not replace the UNIQUE for the attribute
            // So we replace UNIQUE with '' only if there exists a primary key
            if (attributes[currField].toUpperCase().indexOf('UNIQUE') > -1 && canBeUniq) {
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

          const index = options.uniqueKeys[columns.name];
          delete options.uniqueKeys[columns.name];
          indexName = indexName.replace(/[.,\s]/g, '');
          columns.name = indexName;
          options.uniqueKeys[indexName] = index;

          // We cannot auto-generate unique constraint name because sequelize tries to 
          // Add unique column again when it doesn't find unique constraint name after doing showIndexQuery
          // MYSQL doesn't support constraint name > 64 and they face similar issue if size exceed 64 chars
          // TODO: We need to address this with next fix
          if (indexName.length > 128) {
            values.attributes += ',UNIQUE (' + columns.fields.map(field => self.quoteIdentifier(field)).join(', ') + ')';
          } else {
            values.attributes +=
              ', CONSTRAINT ' + this.quoteIdentifier(indexName) + ' UNIQUE (' + columns.fields.map(field => self.quoteIdentifier(field)).join(', ') + ')';
          }
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
        ? "WHERE (atc.OWNER = <%= schema %>) "
        : 'WHERE atc.OWNER = USER ',
      "AND (atc.TABLE_NAME = <%= tableName %>)",
      'ORDER BY "PRIMARY", atc.COLUMN_NAME'
    ].join('');

    const currTableName = this.getCatalogName(tableName.tableName || tableName);
    schema = this.getCatalogName(schema);

    const values = {
      tableName: wrapSingleQuote(currTableName),
      schema: schema ? wrapSingleQuote(schema) : schema,
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

  showConstraintsQuery(table) {
    let tableName = this.getCatalogName(table.tableName || table);
    return `SELECT CONSTRAINT_NAME constraint_name FROM user_cons_columns WHERE table_name = ` + wrapSingleQuote(tableName);
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

  /*
    Modifying the indexname so that it is prefixed with the schema name
    otherwise Oracle tries to add the index to the USER schema
   @overide
  */
   addIndexQuery(tableName, attributes, options, rawTablename) {
    if (typeof tableName !== 'string' && attributes.name) {
      attributes.name = tableName.schema + '.' + attributes.name;
    }
    return super.addIndexQuery(tableName, attributes, options, rawTablename)
   }

  addConstraintQuery(tableName, options) {
    options = options || {};

    const constraintSnippet = this.getConstraintSnippet(tableName, options);

    if (typeof tableName === 'string') {
      tableName = this.quoteIdentifier(tableName);
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
          .replace('ATTRIBUTENAME', this.quoteIdentifier(key))
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

  /**
   * Function to add new foreign key to the attribute 
   * Block for add and drop foreign key constraint query
   * taking the assumption that there is a single column foreign key reference always
   * i.e. we always do - FOREIGN KEY (a) reference B(a) during createTable queryGenerator
   * so there would be one and only one match for a constraint name for each column
   * and every foreign keyed column would have a different constraint name
   * Since sequelize doesn't support multiple column foreign key, added complexity to
   * add the feature isn't needed
   * @param {array} sql Array with sql blocks
   * @param {string} definition The operation that needs to be performed on the attribute
   * @param {string|object} table The table that needs to be altered
   * @param {string} attributeName The name of the attribute which would get altered
   */
  _alterForeignKeyConstraint(sql, definition, table, attributeName) {
    const [tableName, schemaName]  = this.getSchemaNameAndTableName(table);
    const attributeNameConstant = wrapSingleQuote(this.getCatalogName(attributeName));
    const schemaNameConstant = table.schema ? wrapSingleQuote(this.getCatalogName(schemaName)) : 'USER';
    const tableNameConstant = wrapSingleQuote(this.getCatalogName(tableName));
    const constraintString = _.template('FOREIGN KEY (<%= attrName %>) <%= definition %>')({
      attrName: this.quoteIdentifier(attributeName),
      definition: definition.replace(/.+?(?=REFERENCES)/, '')
    });
    const getConsNameQuery = [
      'select constraint_name into cons_name',
      'from (',
        'select distinct cc.owner, cc.table_name, cc.constraint_name,',
        'cc.column_name',
        'as cons_columns',
        'from all_cons_columns cc, all_constraints c',
        'where cc.owner = c.owner',
        'and cc.table_name = c.table_name',
        'and cc.constraint_name = c.constraint_name',
        `and c.constraint_type = 'R'`,
        'group by cc.owner, cc.table_name, cc.constraint_name, cc.column_name',
      ')',
      'where owner =',
      schemaNameConstant,
      'and table_name =',
      tableNameConstant,
      'and cons_columns =',
      attributeNameConstant,
      ';',
    ].join(' ');
    let fullQuery = [
      'BEGIN',
      getConsNameQuery,
      "EXCEPTION",
      "WHEN NO_DATA_FOUND THEN",
        "CONS_NAME := NULL;",
      'END;',
      "IF CONS_NAME IS NOT NULL THEN",
        `EXECUTE IMMEDIATE 'ALTER TABLE <%= tableName %> DROP CONSTRAINT "'||CONS_NAME||'"';`,
      "END IF;",
      "EXECUTE IMMEDIATE '<%= secondQuery %>';",
    ].join(' ');
    const secondQuery = 'ALTER TABLE ' + this.quoteIdentifier(tableName) + ' ADD ' + constraintString;
    fullQuery = _.template(fullQuery)({
      tableName: this.quoteTable(table), 
      secondQuery,
    });
    sql.push(fullQuery);
  }

  /**
   * Function to alter table modify
   * @param {array} sql Array with sql blocks
   * @param {string} definition The operation that needs to be performed on the attribute
   * @param {object|string} table The table that needs to be altered
   * @param {string} attributeName The name of the attribute which would get altered
   */
  _modifyQuery(sql, definition, table, attributeName) {
    const finalQuery =  _.template('<%= attrName %> <%= definition %>')({
      attrName: this.quoteIdentifier(attributeName),
      definition
    });
    const fullQuery = [
      'BEGIN',
      "EXECUTE IMMEDIATE '<%= fullQuery %>';",
      'EXCEPTION',
        'WHEN OTHERS THEN',
          'IF SQLCODE = -1442 OR SQLCODE = -1451 THEN',
            //We execute the statement without the NULL / NOT NULL clause if the first statement failed due to this
            "EXECUTE IMMEDIATE '<%= secondQuery %>';",
          'ELSE',
            'RAISE;',
          'END IF;',
      'END;'
    ].join(' ');
    let query = 'ALTER TABLE <%= tableName %> MODIFY (<%= query %>)';;
    query = _.template(query)({
      tableName: this.quoteTable(table),
      query: finalQuery
    });
    const secondQuery = query.replace('NOT NULL', '').replace('NULL', '');
    query = _.template(fullQuery)({
      tableName: this.quoteTable(table),
      fullQuery: query,
      secondQuery
    });
    sql.push(query);
  }

  changeColumnQuery(table, attributes) {
    const sql = [
      'DECLARE',
        'CONS_NAME VARCHAR2(200);',
      'BEGIN',
    ];
    for (const attributeName in attributes) {
      let definition = attributes[attributeName];
      if (definition.match(/REFERENCES/)) {
        this._alterForeignKeyConstraint(sql, definition, table, attributeName);
      } else {
        if (definition.indexOf('CHECK') > -1) {
          definition = definition.replace(/'/g, "''");
        }
        // Building the modify query
        this._modifyQuery(sql, definition, table, attributeName);
      }
    }
    sql.push('END;');
    return sql.join(' ');
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
    let updateQuery = this.updateQuery(tableName, updateValues, where, options, rawAttributes);
    // This bind is passed so that the insert query starts appending to this same bind array
    options.upsertbind = updateQuery.bind;
    let insertQuery = this.insertQuery(tableName, insertValues, rawAttributes, options);

    const sql = [
      'DECLARE ',
      'BEGIN ',
      updateQuery.query,
      '; ',
      ' IF ( SQL%ROWCOUNT = 0 ) THEN ',
      insertQuery.query,
      '; :isUpdate := 0; ',
      'ELSE ',
      ' :isUpdate := 1; ',
      ' END IF; ',
      'END;'
    ];

    let query = sql.join('');
    const result = {query};
    
    if (options.bindParam !== false) {
      result.bind = updateQuery.bind;
    }

    return result
  }

  /*
   * Override of insertQuery, Oracle specific
   */
  insertQuery(table, valueHash, modelAttributes, options) {
    options = options || {};
    _.defaults(options, this.options);
    const inbind = options.upsertbind === undefined ? []: options.upsertbind;
    const inbindParam 
    = options.bindParam === undefined ? this.bindParam(inbind) : options.bindParam;
    const valueQuery = 'INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>)',
      emptyQuery = 'INSERT INTO <%= table %> VALUES (DEFAULT)',
      fields = [],
      values = [],
      primaryKeys = [],
      modelAttributeMap = {},
      realTableName = this.quoteTable(table),
      outBindAttributes = {},
      primaryKeyReturn = [];
    let key, query, value;
    const oracledb = this.sequelize.connectionManager.lib;

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
          if (value instanceof Utils.SequelizeMethod || options.bindParam === false) {
            values.push(
              this.escape(value, (modelAttributeMap && modelAttributeMap[key]) || undefined, { context: 'INSERT' })
            );
          } else {
            values.push(this.format(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'INSERT' }, inbindParam));
          }
        }
      }
    }

    let primaryKey = '';
    const outbind = [];
    const outbindParam = this.bindParam(outbind, inbind.length);

    primaryKeys.forEach(element => {
        outBindAttributes[element.field] =  Object.assign(element.type._getBindDef(oracledb), { dir: oracledb.BIND_OUT });
        primaryKey +=
          primaryKey.length > 0 ? ',' + this.quoteIdentifier(element.field) : this.quoteIdentifier(element.field);
        const pkReturn = `${this.format(undefined, undefined, { context: 'INSERT' }, outbindParam)}`;
          primaryKeyReturn.push(pkReturn);
    });

    //If we want a return AND we haven't specified a primary key in the column list
    if (options.returning && primaryKey === '') {
      const tableKeys = Object.keys(this.sequelize.models);
      const currTableName = _.isPlainObject(table) ? this.quoteTable(table.tableName) : this.quoteTable(table);

      const currentModelKey = tableKeys.find(modelKey => {
        return this.sequelize.models[modelKey].tableName === currTableName;
      });

      const currentModel = this.sequelize.models[currentModelKey];
      if ((!currentModel || !currentModel.hasPrimaryKeys) && modelAttributes) {
        //We don't have a primaryKey, so we will return the first column inserted
        let element = modelAttributes[Object.keys(modelAttributes)[0]];
        outBindAttributes[element.field] = Object.assign(element.type._getBindDef(oracledb), { dir: oracledb.BIND_OUT })
        const pkReturn = `${this.format(undefined, undefined, { context: 'INSERT' }, outbindParam)}`;
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
    query = _.template(query)(replacements);
    const result = { query };
    if (options.bindParam !== false) {
      options.values = values;
      result.bind = inbind;
    }
    options.outBindAttributes = outBindAttributes;
    return result;
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
              return this.escape(attrValueHash[key], attributes[key], { context: 'INSERT' }) + ' AS "' + key + '"';
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

  deleteQuery(tableName, where, options, model) {
    options = options || {};

    const table = tableName;

    where = this.getWhereConditions(where, null, model, options);
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

  showIndexesQuery(table) {
    let [tableName, owner] = this.getSchemaNameAndTableName(table);
    const sql = [
      'SELECT i.index_name,i.table_name, i.column_name, u.uniqueness, i.descend ',
      'FROM all_ind_columns i ',
      'INNER JOIN all_indexes u ',
      'ON (u.table_name = i.table_name AND u.index_name = i.index_name) ',
      `WHERE i.table_name = <%= tableName %>`,
      " AND u.TABLE_OWNER = ",
      owner ? wrapSingleQuote(owner) : 'USER',
      ' ORDER BY INDEX_NAME, COLUMN_NAME'
    ];

    const request = sql.join('');
    return _.template(request)({
      tableName: wrapSingleQuote(tableName),
    });
  }

  removeIndexQuery(tableName, indexNameOrAttributes) {
    const sql = 'DROP INDEX <%= indexName %>';
    let indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
    }

    const values = {
      tabelName: this.quoteTable(tableName),
      indexName: this.quoteIdentifier(indexName)
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
    } else if (attribute.type instanceof DataTypes.JSON) {
      template = attribute.type.toSql();
      template += ` CHECK (ATTRIBUTENAME IS JSON)`;
      return template;
    } else if (attribute.type instanceof DataTypes.BOOLEAN) {
      template = attribute.type.toSql();
      template +=
        ` CHECK (ATTRIBUTENAME IN('1', '0'))`;
      return template;
    } else {
      if (attribute.autoIncrement) {
        template = ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY';
      } else {
        if (attribute.type && attribute.type.key === DataTypes.DOUBLE.key) {
          template = attribute.type.toSql();
        } else {
          if (attribute.type) {
            // setting it to false because oracle doesn't support unsigned int so put a check to make it behave like unsigned int
            let unsignedTemplate = '';
            if (attribute.type._unsigned) {
              attribute.type._unsigned = false
              unsignedTemplate += " check(" + this.quoteIdentifier(attribute.field) + " >= 0)";
            }
            template = attribute.type.toString();
            template += unsignedTemplate;
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
        template += ' (' + this.quoteIdentifier(attribute.references.key) + ')';
      } else {
        template += ' (' + this.quoteIdentifier('id') + ')';
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
      result[attributeName] = this.attributeToSQL(attribute, options).replace('ATTRIBUTENAME', this.quoteIdentifier(attributeName));
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

  getConstraintsOnColumn(table, column) {
    const [tableName, schemaName] = this.getSchemaNameAndTableName(table);
    column = this.getCatalogName(column);
    const sql = [
      "SELECT CONSTRAINT_NAME FROM user_cons_columns WHERE TABLE_NAME = ",
      wrapSingleQuote(tableName),
      " and OWNER = ",
      table.schema ?  wrapSingleQuote(schemaName) : 'USER',
      " and COLUMN_NAME = ",
      wrapSingleQuote(column),
      " AND POSITION IS NOT NULL ORDER BY POSITION"
    ].join('');

    return sql;
  }

  getForeignKeysQuery(table) {
    //We don't call quoteTable as we don't want the schema in the table name, Oracle seperates it on another field
    const [tableName, schemaName] = this.getSchemaNameAndTableName(table);
    const sql = [
      'SELECT DISTINCT  a.table_name "tableName", a.constraint_name "constraintName", a.owner "owner",  a.column_name "columnName",', 
      ' b.table_name "referencedTableName", b.column_name "referencedColumnName"',
      ' FROM all_cons_columns a',
      ' JOIN all_constraints c ON a.owner = c.owner AND a.constraint_name = c.constraint_name',
      ' join all_cons_columns b on c.owner = b.owner and c.r_constraint_name = b.constraint_name',
      " WHERE c.constraint_type  = 'R'",
      " AND a.table_name = ",
      wrapSingleQuote(tableName),
      " AND a.owner = ",
      table.schema ?  wrapSingleQuote(schemaName) : 'USER',
      " order by a.table_name, a.constraint_name"
    ].join('')

    return sql;
  }

  quoteTable(param, as) {
    let table = '';

    if (_.isObject(param)) {
      if (param.schema) {
        table += this.quoteIdentifier(param.schema) + '.';
      }
      table += this.quoteIdentifier(param.tableName);
    } else {
      table = this.quoteIdentifier(param);
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

  getPrimaryKeyConstraintQuery(table) {
    const [tableName, schemaName]  = this.getSchemaNameAndTableName(table);
    const sql = [
      'SELECT cols.column_name, atc.identity_column ',
      'FROM all_constraints cons, all_cons_columns cols ',
      'INNER JOIN all_tab_columns atc ON(atc.table_name = cols.table_name AND atc.COLUMN_NAME = cols.COLUMN_NAME )',
      "WHERE cols.table_name = ",
      wrapSingleQuote(tableName),
      "AND cols.owner = ",
      table.schema ? wrapSingleQuote(schemaName) : 'USER ',
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
  isIdentityPrimaryKey(table) {
    const [tableName, schemaName] = this.getSchemaNameAndTableName(table);
    return [
      "SELECT TABLE_NAME,COLUMN_NAME, COLUMN_NAME,GENERATION_TYPE,IDENTITY_OPTIONS FROM DBA_TAB_IDENTITY_COLS WHERE TABLE_NAME = ",
      wrapSingleQuote(tableName),
      "AND OWNER = ",
      table.schema ? wrapSingleQuote(schemaName) : 'USER '
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

    switch (value) {
      case Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED:
      case Transaction.ISOLATION_LEVELS.READ_COMMITTED:
        return 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;';
      case Transaction.ISOLATION_LEVELS.REPEATABLE_READ:
        // Serializable mode is equal to Snapshot Isolation (SI) 
        // defined in ANSI std.
        return 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;';
      default:
        throw new Error(`isolation level "${value}" is not supported`);
    }
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
    this._throwOnEmptyAttributes(attributes, { modelName: model && model.name, as: mainTableAs });
    let mainFragment = 'SELECT ' + attributes.join(', ') + ' FROM ' + tables;

    if (mainTableAs) {
      mainFragment += ' ' + mainTableAs;
    }

    return mainFragment;
  }

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    let str;
    if (smth instanceof Utils.Json) {
      // Parse nested object
      if (smth.conditions) {
        const conditions = this.parseConditionObject(smth.conditions).map(condition =>
          `${this.jsonPathExtractionQuery(condition.path[0], _.tail(condition.path))} = '${condition.value}'`
        );

        return conditions.join(' AND ');
      }
      if (smth.path) {
        const paths = _.toPath(smth.path);
        const column = paths.shift();
        str = this.jsonPathExtractionQuery(column, paths);

        if (smth.value) {
          str += util.format(' = %s', this.escape(smth.value));
        }

        return str;
      }
    }
    if (smth instanceof Utils.Cast) {
      if (smth.val instanceof Utils.SequelizeMethod) {
        str = this.handleSequelizeMethod(smth.val, tableName, factory, options, prepend);
        if (smth.type === 'boolean') {
          str = '(CASE WHEN ' + str + `='true' THEN 1 ELSE 0 END)`;
          return `CAST(${str} AS NUMBER)`;
        } else if (smth.type === 'timestamptz' && (/json_value\(/.test(str))) {
          str = str.slice(0, -1);
          return `${str} RETURNING TIMESTAMP WITH TIME ZONE)`;
        }
      }
    }
    return super.handleSequelizeMethod(smth, tableName, factory, options, prepend);
  }

  jsonPathExtractionQuery(column, path) {
    let paths = _.toPath(path);
    let pathStr;
    const quotedColumn = this.isIdentifierQuoted(column) ? column : this.quoteIdentifier(column);

    paths = paths.map(subPath => {
      return /\D/.test(subPath) ? Utils.addTicks(subPath, '"') : subPath;
    });

    pathStr = this.escape(['$'].concat(paths).join('.').replace(/\.(\d+)(?:(?=\.)|$)/g, (__, digit) => `[${digit}]`));

    return `json_value(${quotedColumn},${pathStr})`;
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

  /**
   * It causes bindbyPosition like :1, :2, :3
   * We pass the val parameter so that the outBind indexes
   * starts after the inBind indexes end 
   */
  bindParam(bind, posOffset = 0) {
    return value => {
      bind.push(value);
      return `:${bind.length + posOffset}`;
    };
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
