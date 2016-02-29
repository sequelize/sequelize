'use strict';

/* jshint -W110 */
var Utils = require('../../utils')
  , DataTypes = require('../../data-types')
  , Model = require('../../model')
  , AbstractQueryGenerator = require('../abstract/query-generator')
  , _ = require('lodash')
  , util = require('util')
  , semver = require('semver');

/* istanbul ignore next */
var throwMethodUndefined = function(methodName) {
  throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
};

var QueryGenerator = {
  options: {},
  dialect: 'mssql',

  createSchema: function(schema) {
    return [
      'IF NOT EXISTS (SELECT schema_name',
      'FROM information_schema.schemata',
      'WHERE schema_name =', wrapSingleQuote(schema), ')',
      'BEGIN',
        "EXEC sp_executesql N'CREATE SCHEMA",
        this.quoteIdentifier(schema),
        ";'",
      'END;'
    ].join(' ');
  },

  showSchemasQuery: function() {
    return [
      'SELECT "name" as "schema_name" FROM sys.schemas as s',
      'WHERE "s"."name" NOT IN (',
        "'INFORMATION_SCHEMA', 'dbo', 'guest', 'sys', 'archive'",
      ')', 'AND', '"s"."name" NOT LIKE', "'db_%'"
    ].join(' ');
  },

  versionQuery: function() {
    // Uses string manipulation to convert the MS Maj.Min.Patch.Build to semver Maj.Min.Patch
    return "select reverse(substring(reverse(convert(nvarchar(20), serverproperty('ProductVersion'))), charindex('.', reverse(convert(nvarchar(20), serverproperty('ProductVersion'))))+1, 20)) as 'version'";
  },

  createTableQuery: function(tableName, attributes, options) {
    var query = "IF OBJECT_ID('<%= table %>', 'U') IS NULL CREATE TABLE <%= table %> (<%= attributes %>)"
      , primaryKeys = []
      , foreignKeys = {}
      , attrStr = []
      , self = this;

    for (var attr in attributes) {
      if (attributes.hasOwnProperty(attr)) {
        var dataType = attributes[attr]
          , match;

        if (Utils._.includes(dataType, 'PRIMARY KEY')) {
          primaryKeys.push(attr);

          if (Utils._.includes(dataType, 'REFERENCES')) {
             // MSSQL doesn't support inline REFERENCES declarations: move to the end
            match = dataType.match(/^(.+) (REFERENCES.*)$/);
            attrStr.push(this.quoteIdentifier(attr) + ' ' + match[1].replace(/PRIMARY KEY/, ''));
            foreignKeys[attr] = match[2];
          } else {
            attrStr.push(this.quoteIdentifier(attr) + ' ' + dataType.replace(/PRIMARY KEY/, ''));
          }
        } else if (Utils._.includes(dataType, 'REFERENCES')) {
          // MSSQL doesn't support inline REFERENCES declarations: move to the end
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(this.quoteIdentifier(attr) + ' ' + match[1]);
          foreignKeys[attr] = match[2];
        } else {
          attrStr.push(this.quoteIdentifier(attr) + ' ' + dataType);
        }
      }
    }

    var values = {
      table: this.quoteTable(tableName),
      attributes: attrStr.join(', '),
    }
    , pkString = primaryKeys.map(function(pk) { return this.quoteIdentifier(pk); }.bind(this)).join(', ');

    if (!!options.uniqueKeys) {
      Utils._.each(options.uniqueKeys, function(columns, indexName) {
        if (!Utils._.isString(indexName)) {
          indexName = 'uniq_' + tableName + '_' + columns.fields.join('_');
        }
        values.attributes += ', CONSTRAINT ' + self.quoteIdentifier(indexName) + ' UNIQUE (' + Utils._.map(columns.fields, self.quoteIdentifier).join(', ') + ')';
      });
    }

    if (pkString.length > 0) {
      values.attributes += ', PRIMARY KEY (' + pkString + ')';
    }

    for (var fkey in foreignKeys) {
      if (foreignKeys.hasOwnProperty(fkey)) {
        values.attributes += ', FOREIGN KEY (' + this.quoteIdentifier(fkey) + ') ' + foreignKeys[fkey];
      }
    }

    return Utils._.template(query)(values).trim() + ';';
  },

  describeTableQuery: function(tableName, schema) {
    var sql = [
      'SELECT',
        "c.COLUMN_NAME AS 'Name',",
        "c.DATA_TYPE AS 'Type',",
        "c.IS_NULLABLE as 'IsNull',",
        "COLUMN_DEFAULT AS 'Default',",
        "tc.CONSTRAINT_TYPE AS 'Constraint'",
      'FROM',
        'INFORMATION_SCHEMA.TABLES t',
      'INNER JOIN',
        'INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME',
      'LEFT JOIN',
        'INFORMATION_SCHEMA.KEY_COLUMN_USAGE cu ON t.TABLE_NAME = cu.TABLE_NAME AND cu.COLUMN_NAME = c.COLUMN_NAME',
      'LEFT JOIN',
        'INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc ON t.TABLE_NAME = tc.TABLE_NAME AND cu.COLUMN_NAME = c.COLUMN_NAME AND tc.CONSTRAINT_TYPE = \'PRIMARY KEY\'',
      'WHERE t.TABLE_NAME =', wrapSingleQuote(tableName)
    ].join(' ');

    if (schema) {
      sql += 'AND t.TABLE_SCHEMA =' + wrapSingleQuote(schema);
    }

    return sql;
  },

  renameTableQuery: function(before, after) {
    var query = 'EXEC sp_rename <%= before %>, <%= after %>;';
    return Utils._.template(query)({
      before: this.quoteTable(before),
      after: this.quoteTable(after)
    });
  },

  showTablesQuery: function () {
    return 'SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES;';
  },

  dropTableQuery: function(tableName) {
    var query = "IF OBJECT_ID('<%= table %>', 'U') IS NOT NULL DROP TABLE <%= table %>";
    var values = {
      table: this.quoteTable(tableName)
    };

    return Utils._.template(query)(values).trim() + ';';
  },

  addColumnQuery: function(table, key, dataType) {
    // FIXME: attributeToSQL SHOULD be using attributes in addColumnQuery
    //        but instead we need to pass the key along as the field here
    dataType.field = key;

    var query = 'ALTER TABLE <%= table %> ADD <%= attribute %>;'
      , attribute = Utils._.template('<%= key %> <%= definition %>')({
        key: this.quoteIdentifier(key),
        definition: this.attributeToSQL(dataType, {
          context: 'addColumn'
        })
      });

    return Utils._.template(query)({
      table: this.quoteTable(table),
      attribute: attribute
    });
  },

  removeColumnQuery: function(tableName, attributeName) {
    var query = 'ALTER TABLE <%= tableName %> DROP COLUMN <%= attributeName %>;';
    return Utils._.template(query)({
      tableName: this.quoteTable(tableName),
      attributeName: this.quoteIdentifier(attributeName)
    });
  },

  changeColumnQuery: function(tableName, attributes) {
    var query = 'ALTER TABLE <%= tableName %> <%= query %>;';
    var attrString = [], constraintString = [];

    for (var attributeName in attributes) {
      var definition = attributes[attributeName];
      if (definition.match(/REFERENCES/)) {
        constraintString.push(Utils._.template('<%= fkName %> FOREIGN KEY (<%= attrName %>) <%= definition %>')({
          fkName: this.quoteIdentifier(attributeName + '_foreign_idx'),
          attrName: this.quoteIdentifier(attributeName),
          definition: definition.replace(/.+?(?=REFERENCES)/,'')
        }));
      } else {
        attrString.push(Utils._.template('<%= attrName %> <%= definition %>')({
          attrName: this.quoteIdentifier(attributeName),
          definition: definition
        }));
      }
    }

    var finalQuery = '';
    if (attrString.length) {
      finalQuery += 'ALTER COLUMN ' + attrString.join(', ');
      finalQuery += constraintString.length ? ' ' : '';
    }
    if (constraintString.length) {
      finalQuery += 'ADD CONSTRAINT ' + constraintString.join(', ');
    }

    return Utils._.template(query)({
      tableName: this.quoteTable(tableName),
      query: finalQuery
    });
  },

  renameColumnQuery: function(tableName, attrBefore, attributes) {
    var query = "EXEC sp_rename '<%= tableName %>.<%= before %>', '<%= after %>', 'COLUMN';"
      , newName = Object.keys(attributes)[0];

    return Utils._.template(query)({
      tableName: this.quoteTable(tableName),
      before: attrBefore,
      after: newName
    });
  },

  bulkInsertQuery: function(tableName, attrValueHashes, options, attributes) {
    var query = 'INSERT INTO <%= table %> (<%= attributes %>)<%= output %> VALUES <%= tuples %>;'
      , emptyQuery = 'INSERT INTO <%= table %><%= output %> DEFAULT VALUES'
      , tuples = []
      , allAttributes = []
      , needIdentityInsertWrapper = false
      , allQueries = []
      , outputFragment;

    if (options.returning) {
      outputFragment = ' OUTPUT INSERTED.*';
    }

    Utils._.forEach(attrValueHashes, function(attrValueHash) {
      // special case for empty objects with primary keys
      var fields = Object.keys(attrValueHash);
      if (fields.length === 1 && attributes[fields[0]].autoIncrement && attrValueHash[fields[0]] === null) {
        allQueries.push(emptyQuery);
        return;
      }

      // normal case
      Utils._.forOwn(attrValueHash, function(value, key) {
        if (value !== null && attributes[key].autoIncrement) {
          needIdentityInsertWrapper = true;
        }

        if (allAttributes.indexOf(key) === -1) {
          if (value === null && attributes[key].autoIncrement)
            return;

          allAttributes.push(key);
        }
      });
    });

    if (allAttributes.length > 0) {
      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        tuples.push('(' +
          allAttributes.map(function(key) {
            return this.escape(attrValueHash[key]);
          }.bind(this)).join(',') +
        ')');
      }.bind(this));

      allQueries.push(query);
    }

    var replacements = {
      table: this.quoteTable(tableName),
      attributes: allAttributes.map(function(attr) {
                    return this.quoteIdentifier(attr);
                  }.bind(this)).join(','),
      tuples: tuples,
      output: outputFragment
    };

    var generatedQuery = Utils._.template(allQueries.join(';'))(replacements);
    if (needIdentityInsertWrapper) {
      generatedQuery = [
        'SET IDENTITY_INSERT', this.quoteTable(tableName), 'ON;',
        generatedQuery,
        'SET IDENTITY_INSERT', this.quoteTable(tableName), 'OFF;',
      ].join(' ');
    }

    return generatedQuery;
  },

  deleteQuery: function(tableName, where, options) {
    options = options || {};

    var table = this.quoteTable(tableName);
    if (options.truncate === true) {
      // Truncate does not allow LIMIT and WHERE
      return 'TRUNCATE TABLE ' + table;
    }

    where = this.getWhereConditions(where);
    var limit = ''
      , query = 'DELETE<%= limit %> FROM <%= table %><%= where %>; ' +
                'SELECT @@ROWCOUNT AS AFFECTEDROWS;';

    if (Utils._.isUndefined(options.limit)) {
      options.limit = 1;
    }

    if (!!options.limit) {
      limit = ' TOP(' + this.escape(options.limit) + ')';
    }

    var replacements = {
      limit: limit,
      table: table,
      where: where,
    };

    if (replacements.where) {
      replacements.where = ' WHERE ' + replacements.where;
    }

    return Utils._.template(query)(replacements);
  },

  showIndexesQuery: function(tableName) {
    var sql = "EXEC sys.sp_helpindex @objname = N'<%= tableName %>';";
    return Utils._.template(sql)({
      tableName: this.quoteTable(tableName)
    });
  },

  removeIndexQuery: function(tableName, indexNameOrAttributes) {
    var sql = 'DROP INDEX <%= indexName %> ON <%= tableName %>'
      , indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.inflection.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
    }

    var values = {
      tableName: this.quoteIdentifiers(tableName),
      indexName: indexName
    };

    return Utils._.template(sql)(values);
  },

  attributeToSQL: function(attribute) {
    if (!Utils._.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }

    // handle self referential constraints
    if (attribute.references) {
      attribute = Utils.formatReferences(attribute);

      if (attribute.Model && attribute.Model.tableName === attribute.references.model) {
        this.sequelize.log('MSSQL does not support self referencial constraints, '
          + 'we will remove it but we recommend restructuring your query');
        attribute.onDelete = '';
        attribute.onUpdate = '';
      }
    }

    var template;

    if (attribute.type instanceof DataTypes.ENUM) {
      if (attribute.type.values && !attribute.values) attribute.values = attribute.type.values;

      // enums are a special case
      template = attribute.type.toSql();
      template += ' CHECK (' + attribute.field + ' IN(' + Utils._.map(attribute.values, function(value) {
        return this.escape(value);
      }.bind(this)).join(', ') + '))';
      return template;
    } else {
      template = attribute.type.toString();
    }

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    } else if (!attribute.primaryKey && !Utils.defaultValueSchemable(attribute.defaultValue)) {
      template += ' NULL';
    }

    if (attribute.autoIncrement) {
      template += ' IDENTITY(1,1)';
    }

    // Blobs/texts cannot have a defaultValue
    if (attribute.type !== 'TEXT' && attribute.type._binary !== true &&
        Utils.defaultValueSchemable(attribute.defaultValue)) {
      template += ' DEFAULT ' + this.escape(attribute.defaultValue);
    }

    if (attribute.unique === true) {
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

      if (attribute.onUpdate) {
        template += ' ON UPDATE ' + attribute.onUpdate.toUpperCase();
      }
    }

    return template;
  },

  attributesToSQL: function(attributes, options) {
    var result = {}
      , key
      , attribute
      , existingConstraints = [];

    for (key in attributes) {
      attribute = attributes[key];

      if (attribute.references) {
        attribute = Utils.formatReferences(attributes[key]);

        if (existingConstraints.indexOf(attribute.references.model.toString()) !== -1) {
          // no cascading constraints to a table more than once
          attribute.onDelete = '';
          attribute.onUpdate = '';
        } else {
          existingConstraints.push(attribute.references.model.toString());

          // NOTE: this really just disables cascading updates for all
          //       definitions. Can be made more robust to support the
          //       few cases where MSSQL actually supports them
          attribute.onUpdate = '';
        }

      }

      if (key && !attribute.field) attribute.field = key;
      result[attribute.field || key] = this.attributeToSQL(attribute, options);
    }

    return result;
  },

  findAutoIncrementField: function(factory) {
    var fields = [];
    for (var name in factory.attributes) {
      if (factory.attributes.hasOwnProperty(name)) {
        var definition = factory.attributes[name];

        if (definition && definition.autoIncrement) {
          fields.push(name);
        }
      }
    }

    return fields;
  },

  createTrigger: function() {
    throwMethodUndefined('createTrigger');
  },

  dropTrigger: function() {
    throwMethodUndefined('dropTrigger');
  },

  renameTrigger: function() {
    throwMethodUndefined('renameTrigger');
  },

  createFunction: function() {
    throwMethodUndefined('createFunction');
  },

  dropFunction: function() {
    throwMethodUndefined('dropFunction');
  },

  renameFunction: function() {
    throwMethodUndefined('renameFunction');
  },

  quoteIdentifier: function(identifier, force) {
      if (identifier === '*') return identifier;
      return '[' + identifier.replace(/[\[\]']+/g,'') + ']';
  },

  getForeignKeysQuery: function(table) {
    var tableName = table.tableName || table;
    var sql = [
      'SELECT',
        'constraint_name = C.CONSTRAINT_NAME',
      'FROM',
        'INFORMATION_SCHEMA.TABLE_CONSTRAINTS C',
      "WHERE C.CONSTRAINT_TYPE = 'FOREIGN KEY'",
      'AND C.TABLE_NAME =', wrapSingleQuote(tableName)
    ].join(' ');

    if (table.schema) {
      sql += ' AND C.TABLE_SCHEMA =' + wrapSingleQuote(table.schema);
    }

    return sql;
  },

  getForeignKeyQuery: function(table, attributeName) {
    var tableName = table.tableName || table;
    var sql = [
      'SELECT',
        'constraint_name = TC.CONSTRAINT_NAME',
      'FROM',
        'INFORMATION_SCHEMA.TABLE_CONSTRAINTS TC',
        'JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE CCU',
          'ON TC.CONSTRAINT_NAME = CCU.CONSTRAINT_NAME',
      "WHERE TC.CONSTRAINT_TYPE = 'FOREIGN KEY'",
      'AND TC.TABLE_NAME =', wrapSingleQuote(tableName),
      'AND CCU.COLUMN_NAME =', wrapSingleQuote(attributeName),
    ].join(' ');

    if (table.schema) {
      sql += ' AND TC.TABLE_SCHEMA =' + wrapSingleQuote(table.schema);
    }

    return sql;
  },

  dropForeignKeyQuery: function(tableName, foreignKey) {
    return Utils._.template('ALTER TABLE <%= table %> DROP <%= key %>')({
      table: this.quoteTable(tableName),
      key: this.quoteIdentifier(foreignKey)
    });
  },

  getDefaultConstraintQuery: function (tableName, attributeName) {
    var sql = "SELECT name FROM SYS.DEFAULT_CONSTRAINTS " +
      "WHERE PARENT_OBJECT_ID = OBJECT_ID('<%= table %>', 'U') " +
      "AND PARENT_COLUMN_ID = (SELECT column_id FROM sys.columns WHERE NAME = ('<%= column %>') " +
      "AND object_id = OBJECT_ID('<%= table %>', 'U'));";
    return Utils._.template(sql)({
      table: this.quoteTable(tableName),
      column: attributeName
    });
  },

  dropConstraintQuery: function (tableName, constraintName) {
    var sql = 'ALTER TABLE <%= table %> DROP CONSTRAINT <%= constraint %>;';
    return Utils._.template(sql)({
      table: this.quoteTable(tableName),
      constraint: this.quoteIdentifier(constraintName)
    });
  },

  setAutocommitQuery: function(value) {
    return '';
    // return 'SET IMPLICIT_TRANSACTIONS ' + (!!value ? 'OFF' : 'ON') + ';';
  },

  setIsolationLevelQuery: function(value, options) {
    if (options.parent) {
      return;
    }

    return 'SET TRANSACTION ISOLATION LEVEL ' + value + ';';
  },

  startTransactionQuery: function(transaction, options) {
    if (transaction.parent) {
      return 'SAVE TRANSACTION ' + this.quoteIdentifier(transaction.name) + ';';
    }

    return 'BEGIN TRANSACTION;';
  },

  commitTransactionQuery: function(transaction) {
    if (transaction.parent) {
      return;
    }

    return 'COMMIT TRANSACTION;';
  },

  rollbackTransactionQuery: function(transaction, options) {
    if (transaction.parent) {
      return 'ROLLBACK TRANSACTION ' + this.quoteIdentifier(transaction.name) + ';';
    }

    return 'ROLLBACK TRANSACTION;';
  },

  selectQuery: function(tableName, options, model) {
    // Enter and change at your own peril -- Mick Hansen

    options = options || {};

    var table = null
      , self = this
      , query
      , limit = options.limit
      , mainModel = model
      , mainQueryItems = []
      , mainAttributes = options.attributes && options.attributes.slice()
      , mainJoinQueries = []
      // We'll use a subquery if we have a hasMany association and a limit
      , subQuery = options.subQuery === undefined ?
                   limit && options.hasMultiAssociation :
                   options.subQuery
      , subQueryItems = []
      , subQueryAttributes = null
      , subJoinQueries = []
      , mainTableAs = null
      , databaseVersion = self.sequelize.options.databaseVersion
      // String fragment to use for TOP statements in older SQL server versions
      , topFragment = '';

    // Throw an error when offsets are used and not supported
    if(options.offset && semver.satisfies(databaseVersion, '<11.0.0')) {
      throw new Error('OFFSET is not supported by Microsoft SQL Server 2008 and earlier');
    }

    if (options.tableAs) {
      mainTableAs = this.quoteTable(options.tableAs);
    } else if (!Array.isArray(tableName) && model) {
      mainTableAs = this.quoteTable(model.name);
    }

    table = !Array.isArray(tableName) ? this.quoteTable(tableName) : tableName.map(function(t) {
      if (Array.isArray(t)) {
        return this.quoteTable(t[0], t[1]);
      }
      return this.quoteTable(t, true);
    }.bind(this)).join(', ');

    if (subQuery && mainAttributes) {
      model.primaryKeyAttributes.forEach(function(keyAtt) {
        // Check if mainAttributes contain the primary key of the model either as a field or an aliased field
        if (!_.find(mainAttributes, function (attr) {
          return keyAtt === attr || keyAtt === attr[0] || keyAtt === attr[1];
        })) {
          mainAttributes.push(model.rawAttributes[keyAtt].field ? [keyAtt, model.rawAttributes[keyAtt].field] : keyAtt);
        }
      });
    }

    // Escape attributes
    mainAttributes = mainAttributes && mainAttributes.map(function(attr) {
      var addTable = true;

      if (attr._isSequelizeMethod) {
        return self.handleSequelizeMethod(attr);
      }

      if (Array.isArray(attr) && attr.length === 2) {
        attr = attr.slice();

        if (attr[0]._isSequelizeMethod) {
          attr[0] = self.handleSequelizeMethod(attr[0]);
          addTable = false;
        } else if (attr[0].indexOf('(') === -1 && attr[0].indexOf(')') === -1) {
            attr[0] = self.quoteIdentifier(attr[0]);
        }
        attr = [attr[0], self.quoteIdentifier(attr[1])].join(' AS ');
      } else {
        attr = attr.indexOf(Utils.TICK_CHAR) < 0 && attr.indexOf('"') < 0 ? self.quoteIdentifiers(attr) : attr;
      }

      if (options.include && attr.indexOf('.') === -1 && addTable) {
        attr = mainTableAs + '.' + attr;
      }
      return attr;
    });

    // If no attributes specified, use *
    mainAttributes = mainAttributes || (options.include ? [mainTableAs + '.*'] : ['*']);

    // Define TOP (equivalent to LIMIT) for older SQL Server versions
    if(options.limit && semver.satisfies(databaseVersion, '<11.0.0')) {
      topFragment = ' TOP ' + options.limit + ' ';
    }

    // If subquery, we ad the mainAttributes to the subQuery and set the mainAttributes to select * from subquery
    if (subQuery || options.groupedLimit) {
      // We need primary keys
      subQueryAttributes = mainAttributes;
      mainAttributes = [(mainTableAs || table) + '.*'];
    }

    if (options.include) {
      var generateJoinQueries = function(include, parentTable) {
        var table = include.model.getTableName()
          , as = include.as
          , joinQueryItem = ''
          , joinQueries = {
            mainQuery: [],
            subQuery: []
          }
          , attributes
          , association = include.association
          , through = include.through
          , joinType = include.required ? ' INNER JOIN ' : ' LEFT OUTER JOIN '
          , parentIsTop = !include.parent.association && include.parent.model.name === options.model.name
          , whereOptions = Utils._.clone(options)
          , targetWhere;

        whereOptions.keysEscaped = true;

        if (tableName !== parentTable && mainTableAs !== parentTable) {
          as = parentTable + '.' + include.as;
        }

        // includeIgnoreAttributes is used by aggregate functions
        if (options.includeIgnoreAttributes !== false) {
          attributes = include.attributes.map(function(attr) {
            var attrAs = attr,
                verbatim = false;

            if (Array.isArray(attr) && attr.length === 2) {
              if (attr[0]._isSequelizeMethod) {
                if (attr[0] instanceof Utils.literal ||
                  attr[0] instanceof Utils.cast ||
                  attr[0] instanceof Utils.fn
                ) {
                  verbatim = true;
                }
              }

              attr = attr.map(function($attr) {
                return $attr._isSequelizeMethod ? self.handleSequelizeMethod($attr) : $attr;
              });

              attrAs = attr[1];
              attr = attr[0];
            } else if (attr instanceof Utils.literal) {
              return attr.val; // We trust the user to rename the field correctly
            } else if (attr instanceof Utils.cast ||
              attr instanceof Utils.fn
            ) {
              throw new Error(
                'Tried to select attributes using Sequelize.cast or Sequelize.fn without specifying an alias for the result, during eager loading. ' +
                'This means the attribute will not be added to the returned instance'
              );
            }

            var prefix;
            if (verbatim === true) {
              prefix = attr;
            } else {
              prefix = self.quoteIdentifier(as) + '.' + self.quoteIdentifier(attr);
            }
            return prefix + ' AS ' + self.quoteIdentifier(as + '.' + attrAs, true);
          });
          if (include.subQuery && subQuery) {
            subQueryAttributes = subQueryAttributes.concat(attributes);
          } else {
            mainAttributes = mainAttributes.concat(attributes);
          }
        }

        if (through) {
          var throughTable = through.model.getTableName()
            , throughAs = as + '.' + through.as
            , throughAttributes = through.attributes.map(function(attr) {
              return self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(Array.isArray(attr) ? attr[0] : attr) +
                     ' AS ' +
                     self.quoteIdentifier(throughAs + '.' + (Array.isArray(attr) ? attr[1] : attr));
            })
            , primaryKeysSource = association.source.primaryKeyAttributes
            , tableSource = parentTable
            , identSource = association.identifierField
            , attrSource = primaryKeysSource[0]
            , primaryKeysTarget = association.target.primaryKeyAttributes
            , tableTarget = as
            , identTarget = association.foreignIdentifierField
            , attrTarget = association.target.rawAttributes[primaryKeysTarget[0]].field || primaryKeysTarget[0]

            , sourceJoinOn
            , targetJoinOn

            , throughWhere;

          if (options.includeIgnoreAttributes !== false) {
            // Through includes are always hasMany, so we need to add the attributes to the mainAttributes no matter what (Real join will never be executed in subquery)
            mainAttributes = mainAttributes.concat(throughAttributes);
          }

          // Figure out if we need to use field or attribute
          if (!subQuery) {
            attrSource = association.source.rawAttributes[primaryKeysSource[0]].field;
          }
          if (subQuery && !include.subQuery && !include.parent.subQuery && include.parent.model !== mainModel) {
            attrSource = association.source.rawAttributes[primaryKeysSource[0]].field;
          }

          // Filter statement for left side of through
          // Used by both join and subquery where

          // If parent include was in a subquery need to join on the aliased attribute

          if (subQuery && !include.subQuery && include.parent.subQuery && !parentIsTop) {
            sourceJoinOn = self.quoteIdentifier(tableSource + '.' + attrSource) + ' = ';
          } else {
            sourceJoinOn = self.quoteTable(tableSource) + '.' + self.quoteIdentifier(attrSource) + ' = ';
          }
          sourceJoinOn += self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identSource);

          // Filter statement for right side of through
          // Used by both join and subquery where
          targetJoinOn = self.quoteIdentifier(tableTarget) + '.' + self.quoteIdentifier(attrTarget) + ' = ';
          targetJoinOn += self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identTarget);

          if (include.through.where) {
            throughWhere = self.getWhereConditions(include.through.where, self.sequelize.literal(self.quoteIdentifier(throughAs)), include.through.model);
          }

          if (self._dialect.supports.joinTableDependent) {
            // Generate a wrapped join so that the through table join can be dependent on the target join
            joinQueryItem += joinType + '(';
            joinQueryItem += self.quoteTable(throughTable, throughAs);
            joinQueryItem += ' INNER JOIN ' + self.quoteTable(table, as) + ' ON ';
            joinQueryItem += targetJoinOn;

            if (throughWhere) {
              joinQueryItem += ' AND ' + throughWhere;
            }

            joinQueryItem += ') ON '+sourceJoinOn;
          } else {
            // Generate join SQL for left side of through
            joinQueryItem += joinType + self.quoteTable(throughTable, throughAs)  + ' ON ';
            joinQueryItem += sourceJoinOn;

            // Generate join SQL for right side of through
            joinQueryItem += joinType + self.quoteTable(table, as) + ' ON ';
            joinQueryItem += targetJoinOn;

            if (throughWhere) {
              joinQueryItem += ' AND ' + throughWhere;
            }

          }

          if (include.where || include.through.where) {
            if (include.where) {
              targetWhere = self.getWhereConditions(include.where, self.sequelize.literal(self.quoteIdentifier(as)), include.model, whereOptions);
              if (targetWhere) {
                joinQueryItem += ' AND ' + targetWhere;
              }
            }
            if (subQuery && include.required) {
              if (!options.where) options.where = {};
              (function (include) {
                // Closure to use sane local variables

                var parent = include
                  , child = include
                  , nestedIncludes = []
                  , topParent
                  , topInclude
                  , $query;

                while (parent = parent.parent) {
                  nestedIncludes = [_.extend({}, child, {include: nestedIncludes})];
                  child = parent;
                }

                topInclude = nestedIncludes[0];
                topParent = topInclude.parent;

                if (topInclude.through && Object(topInclude.through.model) === topInclude.through.model) {
                  $query = self.selectQuery(topInclude.through.model.getTableName(), {
                    attributes: [topInclude.through.model.primaryKeyField],
                    include: Model.$validateIncludedElements({
                      model: topInclude.through.model,
                      include: [{
                        association: topInclude.association.toTarget,
                        required: true
                      }]
                    }).include,
                    model: topInclude.through.model,
                    where: { $and: [
                      self.sequelize.asIs([
                        self.quoteTable(topParent.model.name) + '.' + self.quoteIdentifier(topParent.model.primaryKeyField),
                        self.quoteIdentifier(topInclude.through.model.name) + '.' + self.quoteIdentifier(topInclude.association.identifierField)
                      ].join(' = ')),
                      topInclude.through.where
                    ]},
                    limit: 1,
                    includeIgnoreAttributes: false
                  }, topInclude.through.model);
                } else {
                  $query = self.selectQuery(topInclude.model.tableName, {
                    attributes: [topInclude.model.primaryKeyAttributes[0]],
                    include: topInclude.include,
                    where: {
                      $join: self.sequelize.asIs([
                        self.quoteTable(topParent.model.name) + '.' + self.quoteIdentifier(topParent.model.primaryKeyAttributes[0]),
                        self.quoteIdentifier(topInclude.model.name) + '.' + self.quoteIdentifier(topInclude.association.identifierField)
                      ].join(' = '))
                    },
                    limit: 1,
                    includeIgnoreAttributes: false
                  }, topInclude.model);
                }

                options.where['__' + throughAs] = self.sequelize.asIs([
                  '(',
                    $query.replace(/\;$/, ''),
                  ')',
                  'IS NOT NULL'
                ].join(' '));
              })(include);
            }
          }
        } else {
          if (subQuery && include.subQueryFilter) {
            var associationWhere = {}
              , $query
              , subQueryWhere;

            associationWhere[association.identifierField] = {
              $raw: self.quoteTable(parentTable) + '.' + self.quoteIdentifier(association.source.primaryKeyField)
            };

            if (!options.where) options.where = {};

            // Creating the as-is where for the subQuery, checks that the required association exists
            $query = self.selectQuery(include.model.getTableName(), {
              attributes: [association.identifierField],
              where: {
                $and: [
                  associationWhere,
                  include.where || {}
                ]
              },
              limit: 1
            }, include.model);

            subQueryWhere = self.sequelize.asIs([
              '(',
                $query.replace(/\;$/, ''),
              ')',
              'IS NOT NULL'
            ].join(' '));

            if (Utils._.isPlainObject(options.where)) {
              options.where['__' + as] = subQueryWhere;
            } else {
              options.where = { $and: [options.where, subQueryWhere] };
            }
          }

          joinQueryItem = ' ' + self.joinIncludeQuery({
            model: mainModel,
            subQuery: options.subQuery,
            include: include,
            groupedLimit: options.groupedLimit
          });
        }

        if (include.subQuery && subQuery) {
          joinQueries.subQuery.push(joinQueryItem);
        } else {
          joinQueries.mainQuery.push(joinQueryItem);
        }

        if (include.include) {
          include.include.filter(function (include) {
            return !include.separate;
          }).forEach(function(childInclude) {
            if (childInclude._pseudo) return;
            var childJoinQueries = generateJoinQueries(childInclude, as);

            if (childInclude.subQuery && subQuery) {
              joinQueries.subQuery = joinQueries.subQuery.concat(childJoinQueries.subQuery);
            }
            if (childJoinQueries.mainQuery) {
              joinQueries.mainQuery = joinQueries.mainQuery.concat(childJoinQueries.mainQuery);
            }

          }.bind(this));
        }

        return joinQueries;
      };

      // Loop through includes and generate subqueries
      options.include.filter(function (include) {
        return !include.separate;
      }).forEach(function(include) {
        var joinQueries = generateJoinQueries(include, mainTableAs);

        subJoinQueries = subJoinQueries.concat(joinQueries.subQuery);
        mainJoinQueries = mainJoinQueries.concat(joinQueries.mainQuery);

      }.bind(this));
    }

    // If using subQuery select defined subQuery attributes and join subJoinQueries
    if (subQuery) {
      subQueryItems.push('SELECT ' + topFragment + subQueryAttributes.join(', ') + ' FROM ' + table);
      if (mainTableAs) {
        subQueryItems.push(' AS ' + mainTableAs);
      }
      subQueryItems.push(subJoinQueries.join(''));

    // Else do it the reguar way
    } else {
      if (options.groupedLimit) {
        if (!mainTableAs) {
          mainTableAs = table;
        }

        mainQueryItems.push('SELECT ' + topFragment + mainAttributes.join(', ') + ' FROM (' +
          options.groupedLimit.values.map(function (value) {
            var where = _.assign({}, options.where);
            where[options.groupedLimit.on] = value;

            return '('+self.selectQuery(
              table,
              {
                attributes: options.attributes,
                limit: options.groupedLimit.limit,
                order: options.order,
                where: where
              },
              model
            ).replace(/;$/, '')+')';
          }).join(
            self._dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION '
          )
        +')');
      } else {
        mainQueryItems.push('SELECT ' + topFragment + mainAttributes.join(', ') + ' FROM ' + table);
      }
      if (mainTableAs) {
        mainQueryItems.push(' AS ' + mainTableAs);
      }
      mainQueryItems.push(mainJoinQueries.join(''));
    }

    // Add WHERE to sub or main query
    if (options.hasOwnProperty('where') && !options.groupedLimit) {
      options.where = this.getWhereConditions(options.where, mainTableAs || tableName, model, options);
      if (options.where) {
        if (subQuery) {
          subQueryItems.push(' WHERE ' + options.where);
        } else {
          mainQueryItems.push(' WHERE ' + options.where);
        }
      }
    }

    // Add GROUP BY to sub or main query
    if (options.group) {
      options.group = Array.isArray(options.group) ? options.group.map(function(t) { return this.quote(t, model); }.bind(this)).join(', ') : options.group;
      if (subQuery) {
        subQueryItems.push(' GROUP BY ' + options.group);
      } else {
        mainQueryItems.push(' GROUP BY ' + options.group);
      }
    }

    // Add HAVING to sub or main query
    if (options.hasOwnProperty('having')) {
      options.having = this.getWhereConditions(options.having, tableName, model, options, false);
      if (subQuery) {
        subQueryItems.push(' HAVING ' + options.having);
      } else {
        mainQueryItems.push(' HAVING ' + options.having);
      }
    }
    // Add ORDER to sub or main query
    if (options.order && !options.groupedLimit) {
      var mainQueryOrder = [];
      var subQueryOrder = [];

      var validateOrder = function(order) {
        if (order instanceof Utils.literal) return;

        if (!_.includes([
          'ASC',
          'DESC',
          'ASC NULLS LAST',
          'DESC NULLS LAST',
          'ASC NULLS FIRST',
          'DESC NULLS FIRST',
          'NULLS FIRST',
          'NULLS LAST'
        ], order.toUpperCase())) {
          throw new Error(util.format('Order must be \'ASC\' or \'DESC\', \'%s\' given', order));
        }
      };

      if (Array.isArray(options.order)) {
        options.order.forEach(function(t) {
          if (Array.isArray(t) && _.size(t) > 1) {
            if (t[0] instanceof Model || t[0].model instanceof Model) {
              if (typeof t[t.length - 2] === 'string') {
                validateOrder(_.last(t));
              }
            } else {
              validateOrder(_.last(t));
            }
          }

          if (subQuery && (Array.isArray(t) && !(t[0] instanceof Model) && !(t[0].model instanceof Model))) {
            subQueryOrder.push(this.quote(t, model));
          }

          mainQueryOrder.push(this.quote(t, model));
        }.bind(this));
      } else {
        mainQueryOrder.push(this.quote(typeof options.order === 'string' ? new Utils.literal(options.order) : options.order, model));
      }

      if (mainQueryOrder.length) {
        mainQueryItems.push(' ORDER BY ' + mainQueryOrder.join(', '));
      }
      if (subQueryOrder.length) {
        subQueryItems.push(' ORDER BY ' + subQueryOrder.join(', '));
      }
    }

    // Add LIMIT, OFFSET to sub or main query
    var limitOrder = this.addLimitAndOffset(options, model);
    if (limitOrder && !options.groupedLimit) {
      if (subQuery) {
        subQueryItems.push(limitOrder);
      } else {
        mainQueryItems.push(limitOrder);
      }
    }

    // If using subQuery, select attributes from wrapped subQuery and join out join tables
    if (subQuery) {
      query = 'SELECT ' + mainAttributes.join(', ') + ' FROM (';
      query += subQueryItems.join('');
      query += ') AS ' + mainTableAs;
      query += mainJoinQueries.join('');
      query += mainQueryItems.join('');
    } else {
      query = mainQueryItems.join('');
    }

    if (options.lock && this._dialect.supports.lock) {
      var lock = options.lock;
      if (typeof options.lock === 'object') {
        lock = options.lock.level;
      }
      if (this._dialect.supports.lockKey && (lock === 'KEY SHARE' || lock === 'NO KEY UPDATE')) {
        query += ' FOR ' + lock;
      } else if (lock === 'SHARE') {
        query += ' ' + this._dialect.supports.forShare;
      } else {
        query += ' FOR UPDATE';
      }
      if (this._dialect.supports.lockOf && options.lock.of instanceof Model) {
        query += ' OF ' + this.quoteTable(options.lock.of.name);
      }
    }

    query += ';';

    return query;
  },

  addLimitAndOffset: function(options, model) {
    // Skip handling of limit and offset as postfixes for older SQL Servre versions
    if(semver.satisfies(this.sequelize.options.databaseVersion, '<11.0.0')) {
      return '';
    };

    var fragment = '';
    var offset = options.offset || 0
      , isSubQuery = options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation;

    // FIXME: This is ripped from selectQuery to determine whether there is already
    //        an ORDER BY added for a subquery. Should be refactored so we dont' need
    //        the duplication. Also consider moving this logic inside the options.order
    //        check, so that we aren't compiling this twice for every invocation.
    var mainQueryOrder = [];
    var subQueryOrder = [];
    if (options.order) {
      if (Array.isArray(options.order)) {
        options.order.forEach(function(t) {
          if (!Array.isArray(t)) {
            if (isSubQuery && !(t instanceof Model) && !(t.model instanceof Model)) {
              subQueryOrder.push(this.quote(t, model));
            }
          } else {
            if (isSubQuery && !(t[0] instanceof Model) && !(t[0].model instanceof Model)) {
              subQueryOrder.push(this.quote(t, model));
            }
            mainQueryOrder.push(this.quote(t, model));
          }
        }.bind(this));
      } else {
        mainQueryOrder.push(options.order);
      }
    }

    if (options.limit || options.offset) {
      if (!options.order || (options.include && !subQueryOrder.length)) {
        fragment += (options.order && !isSubQuery) ? ', ' : ' ORDER BY ';
        fragment += this.quoteIdentifier(model.primaryKeyField);
      }

      if (options.offset || options.limit) {
        fragment += ' OFFSET ' + this.escape(offset) + ' ROWS';
      }

      if (options.limit) {
        fragment += ' FETCH NEXT ' + this.escape(options.limit) + ' ROWS ONLY';
      }
    }

    return fragment;
  },

  booleanValue: function(value) {
    return !!value ? 1 : 0;
  }
};

// private methods
function wrapSingleQuote(identifier){
  return Utils.addTicks(identifier, "'");
}

module.exports = Utils._.extend(Utils._.clone(AbstractQueryGenerator), QueryGenerator);
