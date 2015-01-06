'use strict';

var Utils = require('../../utils')
  , hstore = require('./hstore')
  , util = require('util')
  , DataTypes = require('../../data-types')
  , SqlString = require('../../sql-string')
  , tables = {}
  , AbstractQueryGenerator = require('../abstract/query-generator')
  , primaryKeys = {};

module.exports = (function() {
  var QueryGenerator = {
    options: {},
    dialect: 'postgres',

    createSchema: function(schema) {
      var query = 'CREATE SCHEMA <%= schema%>;';
      return Utils._.template(query)({schema: schema});
    },

    dropSchema: function(schema) {
      var query = 'DROP SCHEMA <%= schema%> CASCADE;';
      return Utils._.template(query)({schema: schema});
    },

    showSchemasQuery: function() {
      return "SELECT schema_name FROM information_schema.schemata WHERE schema_name <> 'information_schema' AND schema_name != 'public' AND schema_name !~ E'^pg_';";
    },

    versionQuery: function() {
      return 'SELECT VERSION() as "version"';
    },

    createTableQuery: function(tableName, attributes, options) {
      var self = this;

      options = Utils._.extend({
      }, options || {});

      primaryKeys[tableName] = [];
      tables[tableName] = {};

      var query = 'CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>)<%= comments %>'
        , comments = ''
        , attrStr = []
        , i;

      if (options.comment && Utils._.isString(options.comment)) {
        comments += '; COMMENT ON TABLE <%= table %> IS ' + this.escape(options.comment);
      }

      for (var attr in attributes) {
        if ((i = attributes[attr].indexOf('COMMENT')) !== -1) {
          // Move comment to a seperate query
          comments += '; ' + attributes[attr].substring(i);
          attributes[attr] = attributes[attr].substring(0, i);
        }

        var dataType = this.pgDataTypeMapping(tableName, attr, attributes[attr]);
        attrStr.push(this.quoteIdentifier(attr) + ' ' + dataType);
      }

      var values = {
        table: this.quoteTable(tableName),
        attributes: attrStr.join(', '),
        comments: Utils._.template(comments, { table: this.quoteTable(tableName)})
      };

      if (!!options.uniqueKeys) {
        Utils._.each(options.uniqueKeys, function(columns) {
          if (!columns.singleField) { // If it's a single field its handled in column def, not as an index
            values.attributes += ', UNIQUE (' + columns.fields.map(function(f) { return self.quoteIdentifiers(f); }).join(', ') + ')';
          }
        });
      }

      var pks = primaryKeys[tableName].map(function(pk) {
        return this.quoteIdentifier(pk);
      }.bind(this)).join(',');

      if (pks.length > 0) {
        values.attributes += ', PRIMARY KEY (' + pks + ')';
      }

      return Utils._.template(query)(values).trim() + ';';
    },

    dropTableQuery: function(tableName, options) {
      options = options || {};
      var query = 'DROP TABLE IF EXISTS <%= table %><%= cascade %>;';
      return Utils._.template(query)({
        table: this.quoteTable(tableName),
        cascade: options.cascade ? ' CASCADE' : ''
      });
    },

    showTablesQuery: function() {
      return "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';";
    },

    describeTableQuery: function(tableName, schema) {
      if (!schema) {
        schema = 'public';
      }

      var query = 'SELECT c.column_name as "Field", c.column_default as "Default", c.is_nullable as "Null", CASE WHEN c.udt_name = \'hstore\' THEN c.udt_name ELSE c.data_type END as "Type", (SELECT array_agg(e.enumlabel) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special" FROM information_schema.columns c WHERE table_name = <%= table %> AND table_schema = <%= schema %>';

      return Utils._.template(query)({
        table: this.escape(tableName),
        schema: this.escape(schema)
      });
    },

    // A recursive parser for nested where conditions
    parseConditionObject: function(_conditions, path) {
      var self = this;

      path = path || [];
      return Utils._.reduce(_conditions, function (r, v, k) { // result, key, value
        if (Utils._.isObject(v)) {
          r = r.concat(self.parseConditionObject(v, path.concat(k))); // Recursively parse objects
        } else {
          r.push({ path: path.concat(k), value: v });
        }
        return r;
      }, []);
    },

    handleSequelizeMethod: function (smth, tableName, factory, options, prepend) {
      var _ = Utils._;
      if (smth instanceof Utils.json) {
        // Parse nested object
        if (smth.conditions) {
          var conditions = _.map(this.parseConditionObject(smth.conditions), function generateSql(condition) {
            return util.format("%s#>>'{%s}' = '%s'",
              _.first(condition.path),
              _.rest(condition.path).join(','),
              condition.value);
          });

          return conditions.join(' and ');
        } else if (smth.path) {
          var str;

          // Allow specifying conditions using the postgres json syntax
          if (_.any(['->', '->>', '#>'], _.partial(_.contains, smth.path))) {
            str = smth.path;
          } else {
            // Also support json dot notation
            var path = smth.path.split('.');
            str = util.format("%s#>>'{%s}'",
              _.first(path),
              _.rest(path).join(','));
          }

          if (smth.value) {
            str += util.format(" = %s", this.escape(smth.value));
          }

          return str;
        }
      } else {
        return AbstractQueryGenerator.handleSequelizeMethod.call(this, smth, tableName, factory, options, prepend);
      }
    },

    addColumnQuery: function(table, key, dataType) {
      var query = 'ALTER TABLE <%= table %> ADD COLUMN <%= attribute %>;'
        , dbDataType = this.attributeToSQL(dataType, {context: 'addColumn'})
        , attribute;

      if ((dataType.type && dataType.type.toString() === DataTypes.ENUM.toString()) || dataType.toString() === DataTypes.ENUM.toString()) {
        query = this.pgEnum(table, key, dataType) + query;
      }

      attribute = Utils._.template('<%= key %> <%= definition %>')({
        key: this.quoteIdentifier(key),
        definition: this.pgDataTypeMapping(table, key, dbDataType)
      });

      return Utils._.template(query)({
        table: this.quoteTable(table),
        attribute: attribute
      });
    },

    arrayValue: function(value, key, _key, factory, logicResult) {
      var col = null
        , coltype = null
        , _realKey = key.split('.').pop().replace(/"/g, '')
        , _value;

      if (value.length === 0) { value = [null]; }

      // Special conditions for searching within an array column type
      if (!!factory && !!factory.rawAttributes[_realKey]) {
        col = factory.rawAttributes[_realKey];
        coltype = col.type;
        if (coltype && typeof coltype !== 'string') {
          coltype = coltype.toString();
        }
      }

      if (col && ((!!coltype && coltype.match(/\[\]$/) !== null) || (col.toString().match(/\[\]$/) !== null))) {
        _value = 'ARRAY[' + value.map(this.escape.bind(this)).join(',') + ']::' + (!!col.type ? col.type : col.toString());

        if (logicResult === 'IN') {
          logicResult = '=';
        }
        return [_key, _value].join(' ' + logicResult + ' ');
      } else {
        _value = '(' + value.map(this.escape.bind(this)).join(',') + ')';
        return [_key, _value].join(' ' + logicResult + ' ');
      }
    },

    removeColumnQuery: function(tableName, attributeName) {
      var query = 'ALTER TABLE <%= tableName %> DROP COLUMN <%= attributeName %>;';
      return Utils._.template(query)({
        tableName: this.quoteIdentifiers(tableName),
        attributeName: this.quoteIdentifier(attributeName)
      });
    },

    changeColumnQuery: function(tableName, attributes) {
      var query = 'ALTER TABLE <%= tableName %> ALTER COLUMN <%= query %>;'
        , sql = [];

      for (var attributeName in attributes) {
        var definition = this.pgDataTypeMapping(tableName, attributeName, attributes[attributeName]);
        var attrSql = '';

        if (definition.indexOf('NOT NULL') > 0) {
          attrSql += Utils._.template(query)({
            tableName: this.quoteTable(tableName),
            query: this.quoteIdentifier(attributeName) + ' SET NOT NULL'
          });

          definition = definition.replace('NOT NULL', '').trim();
        } else {
          attrSql += Utils._.template(query)({
            tableName: this.quoteTable(tableName),
            query: this.quoteIdentifier(attributeName) + ' DROP NOT NULL'
          });
        }

        if (definition.indexOf('DEFAULT') > 0) {
          attrSql += Utils._.template(query)({
            tableName: this.quoteTable(tableName),
            query: this.quoteIdentifier(attributeName) + ' SET DEFAULT ' + definition.match(/DEFAULT ([^;]+)/)[1]
          });

          definition = definition.replace(/(DEFAULT[^;]+)/, '').trim();
        } else {
          attrSql += Utils._.template(query)({
            tableName: this.quoteTable(tableName),
            query: this.quoteIdentifier(attributeName) + ' DROP DEFAULT'
          });
        }

        if (attributes[attributeName].match(/^ENUM\(/)) {
          query = this.pgEnum(tableName, attributeName, attributes[attributeName]) + query;
          definition = definition.replace(/^ENUM\(.+\)/, this.quoteIdentifier('enum_' + tableName + '_' + attributeName));
          definition += ' USING (' + this.quoteIdentifier(attributeName) + '::' + this.quoteIdentifier(definition) + ')';
        }

        if (definition.match(/UNIQUE;*$/)) {
          definition = definition.replace(/UNIQUE;*$/, '');

          attrSql += Utils._.template(query.replace('ALTER COLUMN', ''))({
            tableName: this.quoteTable(tableName),
            query: 'ADD CONSTRAINT ' + this.quoteIdentifier(attributeName + '_unique_idx') + ' UNIQUE (' + this.quoteIdentifier(attributeName) + ')'
          });
        }

        attrSql += Utils._.template(query)({
          tableName: this.quoteTable(tableName),
          query: this.quoteIdentifier(attributeName) + ' TYPE ' + definition
        });

        sql.push(attrSql);
      }

      return sql.join('');
    },

    renameColumnQuery: function(tableName, attrBefore, attributes) {
      var query = 'ALTER TABLE <%= tableName %> RENAME COLUMN <%= attributes %>;';
      var attrString = [];

      for (var attributeName in attributes) {
        attrString.push(Utils._.template('<%= before %> TO <%= after %>')({
          before: this.quoteIdentifier(attrBefore),
          after: this.quoteIdentifier(attributeName)
        }));
      }

      return Utils._.template(query)({
        tableName: this.quoteTable(tableName),
        attributes: attrString.join(', ')
      });
    },

    fn: function(fnName, tableName, body, returns, language) {
      fnName = fnName || 'testfunc';
      language = language || 'plpgsql';
      returns = returns || 'SETOF ' + this.quoteTable(tableName);

      var query = 'CREATE OR REPLACE FUNCTION pg_temp.<%= fnName %>() RETURNS <%= returns %> AS $$ BEGIN <%= body %> END; $$ LANGUAGE <%= language %>; SELECT * FROM pg_temp.<%= fnName %>();';

      return Utils._.template(query)({
        fnName: fnName,
        returns: returns,
        language: language,
        body: body
      });
    },

    exceptionFn: function(fnName, tableName, main, then, when, returns, language) {
      when  = when || 'unique_violation';

      var body = '<%= main %> EXCEPTION WHEN <%= when %> THEN <%= then %>;';
      body = Utils._.template(body, {
        main: main,
        when: when,
        then: then
      });

      return this.fn(fnName, tableName, body, returns, language);
    },

    // http://www.maori.geek.nz/post/postgres_upsert_update_or_insert_in_ger_using_knex_js
    upsertQuery: function (tableName, insertValues, updateValues, where, rawAttributes, options) {
      var insert = this.insertQuery(tableName, insertValues, rawAttributes, options);
      var update = this.updateQuery(tableName, updateValues, where, options, rawAttributes);

      // The numbers here are selected to match the number of affected rows returned by MySQL
      return this.exceptionFn(
        'sequelize_upsert',
        tableName,
        insert + " RETURN 1;",
        update + "; RETURN 2",
        'unique_violation',
        'integer'
      );
    },

    bulkInsertQuery: function(tableName, attrValueHashes, options, modelAttributes) {
      options = options || {};

      var query = 'INSERT INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %>'
        , tuples = []
        , serials = []
        , allAttributes = [];

      if (this._dialect.supports['RETURNING'] && options.returning) {
        query += ' RETURNING *';
      }

      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        Utils._.forOwn(attrValueHash, function(value, key) {
          if (allAttributes.indexOf(key) === -1) {
            allAttributes.push(key);
          }

          if (modelAttributes && modelAttributes[key] && modelAttributes[key].autoIncrement === true) {
            serials.push(key);
          }
        });
      });

      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        tuples.push('(' +
          allAttributes.map(function(key) {
            if (serials.indexOf(key) !== -1) {
              return attrValueHash[key] || 'DEFAULT';
            }
            return this.escape(attrValueHash[key], modelAttributes && modelAttributes[key]);
          }.bind(this)).join(',') +
        ')');
      }.bind(this));

      var replacements = {
        table: this.quoteTable(tableName)
      , attributes: allAttributes.map(function(attr) {
                      return this.quoteIdentifier(attr);
                    }.bind(this)).join(',')
      , tuples: tuples.join(',')
      };

      query = query + ';';

      return Utils._.template(query)(replacements);
    },

    deleteQuery: function(tableName, where, options, model) {
      var query;

      options = options || {};

      tableName = Utils.removeTicks(this.quoteTable(tableName), '"');

      if (options.truncate === true) {
        query = 'TRUNCATE ' + QueryGenerator.quoteIdentifier(tableName);

        if (options.cascade) {
          query += ' CASCADE';
        }

        return query;
      }

      if (Utils._.isUndefined(options.limit)) {
        options.limit = 1;
      }

      primaryKeys[tableName] = primaryKeys[tableName] || [];

      if (!!model && primaryKeys[tableName].length < 1) {
        primaryKeys[tableName] = Object.keys(model.primaryKeys);
      }

      if (options.limit) {
        query = 'DELETE FROM <%= table %> WHERE <%= primaryKeys %> IN (SELECT <%= primaryKeysSelection %> FROM <%= table %> WHERE <%= where %><%= limit %>)';
      } else {
        query = 'DELETE FROM <%= table %> WHERE <%= where %>';
      }

      var pks;
      if (primaryKeys[tableName] && primaryKeys[tableName].length > 0) {
        pks = primaryKeys[tableName].map(function(pk) {
          return this.quoteIdentifier(pk);
        }.bind(this)).join(',');
      } else {
        pks = this.quoteIdentifier('id');
      }

      var replacements = {
        table: this.quoteIdentifiers(tableName),
        where: this.getWhereConditions(where) || '1=1',
        limit: !!options.limit ? ' LIMIT ' + this.escape(options.limit) : '',
        primaryKeys: primaryKeys[tableName].length > 1 ? '(' + pks + ')' : pks,
        primaryKeysSelection: pks
      };

      return Utils._.template(query)(replacements);
    },

    showIndexQuery: function(tableName, options) {
      // This is ARCANE!
      var query = "SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND a.attnum = ANY(ix.indkey) AND t.relkind = 'r' and t.relname = '<%= tableName %>' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;";

      return Utils._.template(query)({ tableName: tableName });
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      var sql = 'DROP INDEX IF EXISTS <%= indexName %>'
        , indexName = indexNameOrAttributes;

      if (typeof indexName !== 'string') {
        indexName = Utils.inflection.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
      }

      return Utils._.template(sql)({
        tableName: this.quoteIdentifiers(tableName),
        indexName: this.quoteIdentifiers(indexName)
      });
    },

    addLimitAndOffset: function(options, model) {
      var fragment = '';
      if (options.limit) fragment += ' LIMIT ' + options.limit;
      if (options.offset) fragment += ' OFFSET ' + options.offset;

      return fragment;
    },

    attributeToSQL: function(attribute, options) {
      if (!Utils._.isPlainObject(attribute)) {
        attribute = {
          type: attribute
        };
      }

      var template = '<%= type %>'
        , replacements = {};

      if (attribute.type.toString() === DataTypes.ENUM.toString()) {
        if (Array.isArray(attribute.values) && (attribute.values.length > 0)) {
          replacements.type = 'ENUM(' + Utils._.map(attribute.values, function(value) {
            return this.escape(value);
          }.bind(this)).join(', ') + ')';
        } else {
          throw new Error('Values for ENUM haven\'t been defined.');
        }
      }

      if (attribute.type === DataTypes.BOOLEAN) {
        attribute.type = 'BOOLEAN';
      }

      if (attribute.type === DataTypes.DATE) {
        attribute._typeName = 'DATETIME';
        attribute.type = 'TIMESTAMP WITH TIME ZONE';
      }

      if (!replacements.type) {
        replacements.type = attribute.type;
      }

      if (attribute.hasOwnProperty('allowNull') && (!attribute.allowNull)) {
        template += ' NOT NULL';
      }

      if (attribute.autoIncrement) {
        template += ' SERIAL';
      }

      if (Utils.defaultValueSchemable(attribute.defaultValue)) {
        template += ' DEFAULT <%= defaultValue %>';
        replacements.defaultValue = this.escape(attribute.defaultValue, attribute);
      }

      if (attribute.unique === true) {
        template += ' UNIQUE';
      }

      if (attribute.primaryKey) {
        template += ' PRIMARY KEY';
      }

      if (attribute.references) {
        template += ' REFERENCES <%= referencesTable %> (<%= referencesKey %>)';
        replacements.referencesTable = this.quoteTable(attribute.references);

        if (attribute.referencesKey) {
          replacements.referencesKey = this.quoteIdentifiers(attribute.referencesKey);
        } else {
          replacements.referencesKey = this.quoteIdentifier('id');
        }

        if (attribute.onDelete) {
          template += ' ON DELETE <%= onDeleteAction %>';
          replacements.onDeleteAction = attribute.onDelete.toUpperCase();
        }

        if (attribute.onUpdate) {
          template += ' ON UPDATE <%= onUpdateAction %>';
          replacements.onUpdateAction = attribute.onUpdate.toUpperCase();
        }
      }

      return  Utils._.template(template)(replacements);
    },

    attributesToSQL: function(attributes, options) {
      var result = {}
        , key
        , attribute;

      for (key in attributes) {
        attribute = attributes[key];
        result[attribute.field || key] = this.attributeToSQL(attribute, options);
      }

      return result;
    },

    findAutoIncrementField: function(factory) {
      var fields = [];

      for (var name in factory.attributes) {
        var definition = factory.attributes[name];

        if (definition && definition.autoIncrement) {
          fields.push(name);
        }
      }

      return fields;
    },

    createTrigger: function(tableName, triggerName, eventType, fireOnSpec, functionName, functionParams, optionsArray) {
      var sql = [
          'CREATE <%= constraintVal %>TRIGGER <%= triggerName %>'
          , '<%= eventType %> <%= eventSpec %>'
          , 'ON <%= tableName %>'
          , '<%= optionsSpec %>'
          , 'EXECUTE PROCEDURE <%= functionName %>(<%= paramList %>);'
        ].join('\n\t');

      return Utils._.template(sql)({
        constraintVal: this.triggerEventTypeIsConstraint(eventType),
        triggerName: triggerName,
        eventType: this.decodeTriggerEventType(eventType),
        eventSpec: this.expandTriggerEventSpec(fireOnSpec),
        tableName: tableName,
        optionsSpec: this.expandOptions(optionsArray),
        functionName: functionName,
        paramList: this.expandFunctionParamList(functionParams)
      });
    },

    dropTrigger: function(tableName, triggerName) {
      var sql = 'DROP TRIGGER <%= triggerName %> ON <%= tableName %> RESTRICT;';
      return Utils._.template(sql)({
        triggerName: triggerName,
        tableName: tableName
      });
    },

    renameTrigger: function(tableName, oldTriggerName, newTriggerName) {
      var sql = 'ALTER TRIGGER <%= oldTriggerName %> ON <%= tableName %> RENAME TO <%= newTriggerName%>;';
      return Utils._.template(sql)({
        tableName: tableName,
        oldTriggerName: oldTriggerName,
        newTriggerName: newTriggerName
      });
    },

    createFunction: function(functionName, params, returnType, language, body, options) {
      var sql = ['CREATE FUNCTION <%= functionName %>(<%= paramList %>)'
          , 'RETURNS <%= returnType %> AS $$'
          , 'BEGIN'
          , '\t<%= body %>'
          , 'END;'
          , "$$ language '<%= language %>'<%= options %>;"
      ].join('\n');

      return Utils._.template(sql)({
        functionName: functionName,
        paramList: this.expandFunctionParamList(params),
        returnType: returnType,
        body: body.replace('\n', '\n\t'),
        language: language,
        options: this.expandOptions(options)
      });
    },

    dropFunction: function(functionName, params) {
      // RESTRICT is (currently, as of 9.2) default but we'll be explicit
      var sql = 'DROP FUNCTION <%= functionName %>(<%= paramList %>) RESTRICT;';
      return Utils._.template(sql)({
        functionName: functionName,
        paramList: this.expandFunctionParamList(params)
      });
    },

    renameFunction: function(oldFunctionName, params, newFunctionName) {
      var sql = 'ALTER FUNCTION <%= oldFunctionName %>(<%= paramList %>) RENAME TO <%= newFunctionName %>;';
      return Utils._.template(sql)({
        oldFunctionName: oldFunctionName,
        paramList: this.expandFunctionParamList(params),
        newFunctionName: newFunctionName
      });
    },

    databaseConnectionUri: function(config) {
      var template = '<%= protocol %>://<%= user %>:<%= password %>@<%= host %><% if(port) { %>:<%= port %><% } %>/<%= database %><% if(ssl) { %>?ssl=<%= ssl %><% } %>';

      return Utils._.template(template)({
        user: config.username,
        password: config.password,
        database: config.database,
        host: config.host,
        port: config.port,
        protocol: config.protocol,
        ssl: config.ssl
      });
    },

    pgEscapeAndQuote: function(val) {
      return this.quoteIdentifier(Utils.removeTicks(this.escape(val), "'"));
    },

    expandFunctionParamList: function expandFunctionParamList(params) {
      if (Utils._.isUndefined(params) || !Utils._.isArray(params)) {
        throw new Error('expandFunctionParamList: function parameters array required, including an empty one for no arguments');
      }

      var paramList = Utils._.each(params, function expandParam(curParam) {
        var paramDef = [];
        if (Utils._.has(curParam, 'type')) {
          if (Utils._.has(curParam, 'direction')) { paramDef.push(curParam.direction); }
          if (Utils._.has(curParam, 'name')) { paramDef.push(curParam.name); }
          paramDef.push(curParam.type);
        } else {
          throw new Error('createFunction called with a parameter with no type');
        }
        return paramDef.join(' ');
      });
      return paramList.join(', ');
    },

    expandOptions: function expandOptions(options) {
      return Utils._.isUndefined(options) || Utils._.isEmpty(options) ?
          '' : '\n\t' + options.join('\n\t');
    },

    decodeTriggerEventType: function decodeTriggerEventType(eventSpecifier) {
      var EVENT_DECODER = {
        'after': 'AFTER',
        'before': 'BEFORE',
        'instead_of': 'INSTEAD OF',
        'after_constraint': 'AFTER'
      };

      if (!Utils._.has(EVENT_DECODER, eventSpecifier)) {
        throw new Error('Invalid trigger event specified: ' + eventSpecifier);
      }

      return EVENT_DECODER[eventSpecifier];
    },

    triggerEventTypeIsConstraint: function triggerEventTypeIsConstraint(eventSpecifier) {
      return eventSpecifier === 'after_constrain' ? 'CONSTRAINT ' : '';
    },

    expandTriggerEventSpec: function expandTriggerEventSpec(fireOnSpec) {
      if (Utils._.isEmpty(fireOnSpec)) {
        throw new Error('no table change events specified to trigger on');
      }

      return Utils._.map(fireOnSpec, function parseTriggerEventSpec(fireValue, fireKey) {
        var EVENT_MAP = {
          'insert': 'INSERT',
          'update': 'UPDATE',
          'delete': 'DELETE',
          'truncate': 'TRUNCATE'
        };

        if (!Utils._.has(EVENT_MAP, fireKey)) {
          throw new Error('parseTriggerEventSpec: undefined trigger event ' + fireKey);
        }

        var eventSpec = EVENT_MAP[fireKey];
        if (eventSpec === 'UPDATE') {
          if (Utils._.isArray(fireValue) && fireValue.length > 0) {
            eventSpec += ' OF ' + fireValue.join(', ');
          }
        }

        return eventSpec;
      }).join(' OR ');
    },

    pgListEnums: function(tableName, attrName, options) {
      if (arguments.length === 1) {
        options = tableName;
        tableName = null;
      }

      var enumName = '';

      if (!!tableName && !!attrName) {
        enumName = ' AND t.typname=' + this.escape('enum_' + tableName + '_' + attrName) + ' ';
      }

      var query = 'SELECT t.typname enum_name, array_agg(e.enumlabel) enum_value FROM pg_type t ' +
        'JOIN pg_enum e ON t.oid = e.enumtypid ' +
        'JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace ' +
        'WHERE n.nspname = \'public\' ' + enumName + ' GROUP BY 1';

      return query;
    },

    pgEnum: function(tableName, attr, dataType, options) {
      var enumName = this.pgEscapeAndQuote('enum_' + tableName + '_' + attr)
        , values;

      if (dataType.values) {
        values = "ENUM('" + dataType.values.join("', '") + "')";
      } else {
        values = dataType.toString().match(/^ENUM\(.+\)/)[0];
      }

      var sql = 'CREATE TYPE ' + enumName + ' AS ' + values + '; ';
      if (!!options && options.force === true) {
        sql = this.pgEnumDrop(tableName, attr) + sql;
      }
      return sql;
    },

    pgEnumAdd: function(tableName, attr, value, options) {
      var enumName = this.pgEscapeAndQuote('enum_' + tableName + '_' + attr);
      var sql = 'ALTER TYPE ' + enumName + ' ADD VALUE ' + this.escape(value);

      if (!!options.before) {
        sql += ' BEFORE ' + this.escape(options.before);
      }
      else if (!!options.after) {
        sql += ' AFTER ' + this.escape(options.after);
      }

      return sql;
    },

    pgEnumDrop: function(tableName, attr, enumName) {
      enumName = enumName || this.pgEscapeAndQuote('enum_' + tableName + '_' + attr);
      return 'DROP TYPE IF EXISTS ' + enumName + '; ';
    },

    fromArray: function(text) {
      text = text.replace(/^{/, '').replace(/}$/, '');
      var matches = text.match(/("(?:\\.|[^"\\\\])*"|[^,]*)(?:\s*,\s*|\s*$)/ig);

      if (matches.length < 1) {
        return [];
      }

      matches = matches.map(function(m) {
        return m.replace(/",$/, '').replace(/,$/, '').replace(/(^"|"$)/, '');
      });

      return matches.slice(0, -1);
    },

    padInt: function(i) {
      return (i < 10) ? '0' + i.toString() : i.toString();
    },

    pgDataTypeMapping: function(tableName, attr, dataType) {
      return this.dataTypeMapping(tableName, attr, dataType);
    },

    dataTypeMapping: function(tableName, attr, dataType) {
      if (Utils._.includes(dataType, 'PRIMARY KEY')) {
        primaryKeys[tableName].push(attr);
        dataType = dataType.replace(/PRIMARY KEY/, '');
      }

      if (Utils._.includes(dataType, 'TINYINT(1)')) {
        dataType = dataType.replace(/TINYINT\(1\)/, 'BOOLEAN');
      }

      if (Utils._.includes(dataType, 'DATETIME')) {
        dataType = dataType.replace(/DATETIME/, 'TIMESTAMP WITH TIME ZONE');
      }

      if (Utils._.includes(dataType, 'SERIAL')) {
        if (Utils._.includes(dataType, 'BIGINT')) {
          dataType = dataType.replace(/SERIAL/, 'BIGSERIAL');
          dataType = dataType.replace(/BIGINT/, '');
          tables[tableName][attr] = 'bigserial';
        } else {
          dataType = dataType.replace(/INTEGER/, '');
          tables[tableName][attr] = 'serial';
        }
        dataType = dataType.replace(/NOT NULL/, '');
      }

      if (Utils._.includes(dataType, 'INTEGER') || Utils._.includes(dataType, 'BIGINT')) {
        dataType = dataType.replace(/(INTEGER|BIGINT)\s*\(\d+\)/, '$1'); // Postgres does not allow length on INTEGER and BIGINT
      }

      if (dataType.lastIndexOf('BLOB') !== -1 || dataType.lastIndexOf('BINARY') !== -1) {
        dataType = 'bytea';
      }

      if (dataType.match(/^ENUM\(/)) {
        dataType = dataType.replace(/^ENUM\(.+\)/, this.pgEscapeAndQuote('enum_' + tableName + '_' + attr));
      }

      return dataType;
    },



    quoteIdentifier: function(identifier, force) {
      var _ = Utils._;
      if (identifier === '*') return identifier;
      if (!force && this.options && this.options.quoteIdentifiers === false) { // default is `true`
        // In Postgres, if tables or attributes are created double-quoted,
        // they are also case sensitive. If they contain any uppercase
        // characters, they must always be double-quoted. This makes it
        // impossible to write queries in portable SQL if tables are created in
        // this way. Hence, we strip quotes if we don't want case sensitivity.
        return Utils.removeTicks(identifier, '"');
      } else {
        return Utils.addTicks(identifier, '"');
      }
    },

    /*
      Escape a value (e.g. a string, number or date)
    */
    escape: function(value, field) {
      if (value && value._isSequelizeMethod) {
        return this.handleSequelizeMethod(value);
      }

      if (Utils._.isObject(value) && field && (field.type === DataTypes.HSTORE || field.type === DataTypes.ARRAY(DataTypes.HSTORE))) {
        if (field.type === DataTypes.HSTORE){
          return "'"  + hstore.stringify(value) + "'";
        } else if (field.type === DataTypes.ARRAY(DataTypes.HSTORE)){
          return "ARRAY[" + Utils._.map(value, function(v){return "'" + hstore.stringify(v) + "'::hstore";}).join(",") + "]::HSTORE[]";
        }
      } else if (Utils._.isObject(value) && field && (field.type === DataTypes.JSON || field.type === DataTypes.JSONB)) {
        value = JSON.stringify(value);
      } else if (Array.isArray(value) && field.type === DataTypes.ARRAY(DataTypes.JSON)) {
        return "ARRAY[" + value.map(function (v) {
          return SqlString.escape(JSON.stringify(v), false, this.options.timezone, this.dialect, field);
        }, this).join(",") + "]::JSON[]";
      }

      return SqlString.escape(value, false, this.options.timezone, this.dialect, field);
    },

    /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} schemaName The name of the schema.
     * @return {String}            The generated sql query.
     */
    getForeignKeysQuery: function(tableName, schemaName) {
      return "SELECT conname as constraint_name, pg_catalog.pg_get_constraintdef(r.oid, true) as condef FROM pg_catalog.pg_constraint r WHERE r.conrelid = (SELECT oid FROM pg_class WHERE relname = '" + tableName + "' LIMIT 1) AND r.contype = 'f' ORDER BY 1;";
    },

    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} foreignKey The name of the foreign key constraint.
     * @return {String}            The generated sql query.
     */
    dropForeignKeyQuery: function(tableName, foreignKey) {
      return 'ALTER TABLE ' + this.quoteTable(tableName) + ' DROP CONSTRAINT ' + this.quoteIdentifier(foreignKey) + ';';
    }
  };

  return Utils._.extend(Utils._.clone(AbstractQueryGenerator), QueryGenerator);
})();
