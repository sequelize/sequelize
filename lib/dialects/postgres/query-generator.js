'use strict';

/* jshint -W110 */
var Utils = require('../../utils')
  , util = require('util')
  , DataTypes = require('../../data-types')
  , AbstractQueryGenerator = require('../abstract/query-generator')
  , semver = require('semver')
  , _ = require('lodash');

var QueryGenerator = {
  options: {},
  dialect: 'postgres',

  setSearchPath: function(searchPath) {
    var query = 'SET search_path to <%= searchPath%>;';
    return Utils._.template(query)({searchPath: searchPath});
  },

  createSchema: function(schema) {
    var query = 'CREATE SCHEMA <%= schema%>;';
    return Utils._.template(query)({schema: schema});
  },

  dropSchema: function(schema) {
    var query = 'DROP SCHEMA IF EXISTS <%= schema%> CASCADE;';
    return Utils._.template(query)({schema: schema});
  },

  showSchemasQuery: function() {
    return "SELECT schema_name FROM information_schema.schemata WHERE schema_name <> 'information_schema' AND schema_name != 'public' AND schema_name !~ E'^pg_';";
  },

  versionQuery: function() {
    return 'SHOW SERVER_VERSION';
  },

  createTableQuery: function(tableName, attributes, options) {
    var self = this;

    options = Utils._.extend({
    }, options || {});

    var databaseVersion = Utils._.get(self, 'sequelize.options.databaseVersion', 0);
    //Postgres 9.0 does not support CREATE TABLE IF NOT EXISTS, 9.1 and above do
    var query = 'CREATE TABLE ' +
                ( (databaseVersion === 0 || semver.gte(databaseVersion, '9.1.0')) ? 'IF NOT EXISTS ' : '') +
                '<%= table %> (<%= attributes%>)<%= comments %>'
      , comments = ''
      , attrStr = []
      , i;

    if (options.comment && Utils._.isString(options.comment)) {
      comments += '; COMMENT ON TABLE <%= table %> IS ' + this.escape(options.comment);
    }

    for (var attr in attributes) {
      if ((i = attributes[attr].indexOf('COMMENT')) !== -1) {
        // Move comment to a separate query
        comments += '; ' + attributes[attr].substring(i);
        attributes[attr] = attributes[attr].substring(0, i);
      }

      var dataType = this.dataTypeMapping(tableName, attr, attributes[attr]);
      attrStr.push(this.quoteIdentifier(attr) + ' ' + dataType);
    }

    var values = {
      table: this.quoteTable(tableName),
      attributes: attrStr.join(', '),
      comments: Utils._.template(comments)({ table: this.quoteTable(tableName)})
    };

    if (!!options.uniqueKeys) {
      Utils._.each(options.uniqueKeys, function(columns) {
        if (!columns.singleField) { // If it's a single field its handled in column def, not as an index
          values.attributes += ', UNIQUE (' + columns.fields.map(function(f) { return self.quoteIdentifiers(f); }).join(', ') + ')';
        }
      });
    }

    var pks = _.reduce(attributes, function (acc, attribute, key) {
      if (_.includes(attribute, 'PRIMARY KEY')) {
        acc.push(this.quoteIdentifier(key));
      }
      return acc;
    }.bind(this), []).join(',');

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
    return "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type LIKE '%TABLE' AND table_name != 'spatial_ref_sys';";
  },

  describeTableQuery: function(tableName, schema) {
    if (!schema) {
      schema = 'public';
    }

    var query = 'SELECT tc.constraint_type as "Constraint", c.column_name as "Field", c.column_default as "Default", c.is_nullable as "Null", ' +
      "CASE WHEN c.udt_name = 'hstore' " +
      'THEN c.udt_name ELSE c.data_type END as "Type", (SELECT array_agg(e.enumlabel) ' +
      'FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special" ' +
      'FROM information_schema.columns c ' +
      'LEFT JOIN information_schema.key_column_usage cu ON c.table_name = cu.table_name AND cu.column_name = c.column_name ' +
      'LEFT JOIN information_schema.table_constraints tc ON c.table_name = tc.table_name AND cu.column_name = c.column_name AND tc.constraint_type = \'PRIMARY KEY\' ' +
      ' WHERE c.table_name = <%= table %> AND c.table_schema = <%= schema %> ';

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
    if (smth instanceof Utils.json) {
      // Parse nested object
      if (smth.conditions) {
        var conditions = _.map(this.parseConditionObject(smth.conditions), function generateSql(condition) {
          return util.format("%s#>>'{%s}' = '%s'",
            _.first(condition.path),
            _.tail(condition.path).join(','),
            condition.value);
        });

        return conditions.join(' and ');
      } else if (smth.path) {
        var str;

        // Allow specifying conditions using the postgres json syntax
        if (_.some(['->', '->>', '#>'], _.partial(_.includes, smth.path))) {
          str = smth.path;
        } else {
          // Also support json dot notation
          var path = smth.path.split('.');
          str = util.format("%s#>>'{%s}'",
              _.first(path),
            _.tail(path).join(','));
        }

        if (smth.value) {
          str += util.format(' = %s', this.escape(smth.value));
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

    if (dataType.type && dataType.type instanceof DataTypes.ENUM || dataType instanceof DataTypes.ENUM) {
      query = this.pgEnum(table, key, dataType) + query;
    }

    attribute = Utils._.template('<%= key %> <%= definition %>')({
      key: this.quoteIdentifier(key),
      definition: this.dataTypeMapping(table, key, dbDataType)
    });

    return Utils._.template(query)({
      table: this.quoteTable(this.extractTableDetails(table)),
      attribute: attribute
    });
  },

  removeColumnQuery: function(tableName, attributeName) {
    var query = 'ALTER TABLE <%= tableName %> DROP COLUMN <%= attributeName %>;';
    return Utils._.template(query)({
      tableName: this.quoteTable(this.extractTableDetails(tableName)),
      attributeName: this.quoteIdentifier(attributeName)
    });
  },

  changeColumnQuery: function(tableName, attributes) {
    var query = 'ALTER TABLE <%= tableName %> ALTER COLUMN <%= query %>;'
      , sql = [];

    for (var attributeName in attributes) {
      var definition = this.dataTypeMapping(tableName, attributeName, attributes[attributeName]);
      var attrSql = '';

      if (definition.indexOf('NOT NULL') > 0) {
        attrSql += Utils._.template(query)({
          tableName: this.quoteTable(tableName),
          query: this.quoteIdentifier(attributeName) + ' SET NOT NULL'
        });

        definition = definition.replace('NOT NULL', '').trim();
      } else if (!definition.match(/REFERENCES/)) {
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
      } else if (!definition.match(/REFERENCES/)) {
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

      if (definition.match(/REFERENCES/)) {
        definition = definition.replace(/.+?(?=REFERENCES)/,'');
        attrSql += Utils._.template(query.replace('ALTER COLUMN', ''))({
          tableName: this.quoteTable(tableName),
          query: 'ADD CONSTRAINT ' + this.quoteIdentifier(attributeName + '_foreign_idx') + ' FOREIGN KEY (' + this.quoteIdentifier(attributeName) + ') ' + definition
        });
      } else {
        attrSql += Utils._.template(query)({
          tableName: this.quoteTable(tableName),
          query: this.quoteIdentifier(attributeName) + ' TYPE ' + definition
        });
      }

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

    var query = 'CREATE OR REPLACE FUNCTION pg_temp.<%= fnName %>() RETURNS <%= returns %> AS $func$ BEGIN <%= body %> END; $func$ LANGUAGE <%= language %>; SELECT * FROM pg_temp.<%= fnName %>();';

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
    body = Utils._.template(body)({
      main: main,
      when: when,
      then: then
    });

    return this.fn(fnName, tableName, body, returns, language);
  },

  upsertQuery: function (tableName, insertValues, updateValues, where, rawAttributes, options) {
    var insert = this.insertQuery(tableName, insertValues, rawAttributes, options);
    var update = this.updateQuery(tableName, updateValues, where, options, rawAttributes);

    // The numbers here are selected to match the number of affected rows returned by MySQL
    return this.exceptionFn(
      'sequelize_upsert',
      tableName,
      insert + ' RETURN 1;',
      update + '; RETURN 2',
      'unique_violation',
      'integer'
    );
  },

  deleteQuery: function(tableName, where, options, model) {
    var query;

    options = options || {};

    tableName = this.quoteTable(tableName);

    if (options.truncate === true) {
      query = 'TRUNCATE ' + tableName;

      if (options.cascade) {
        query += ' CASCADE';
      }

      return query;
    }

    if (Utils._.isUndefined(options.limit)) {
      options.limit = 1;
    }

    var replacements = {
      table: tableName,
      where: this.getWhereConditions(where, null, model, options),
      limit: !!options.limit ? ' LIMIT ' + this.escape(options.limit) : ''
    };

    if (options.limit) {
      if (!model) {
        throw new Error('Cannot LIMIT delete without a model.');
      }

      var pks = _.map(_.values(model.primaryKeys), function (pk) {
        return this.quoteIdentifier((pk.field));
      }.bind(this)).join(',');

      replacements.primaryKeys = model.primaryKeyAttributes.length > 1 ? '(' + pks + ')' : pks;
      replacements.primaryKeysSelection = pks;

      query = 'DELETE FROM <%= table %> WHERE <%= primaryKeys %> IN (SELECT <%= primaryKeysSelection %> FROM <%= table %><%= where %><%= limit %>)';
    } else {
      query = 'DELETE FROM <%= table %><%= where %>';
    }

    if (replacements.where) {
      replacements.where = ' WHERE ' + replacements.where;
    }

    return Utils._.template(query)(replacements);
  },

  showIndexesQuery: function(tableName) {
    var schemaJoin = '', schemaWhere = '';
    if (!Utils._.isString(tableName)) {
      schemaJoin = ', pg_namespace s';
      schemaWhere = Utils._.template(" AND s.oid = t.relnamespace AND s.nspname = '<%= schemaName %>'")({schemaName: tableName.schema});
      tableName = tableName.tableName;
    }

    // This is ARCANE!
    var query = 'SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey, ' +
      'array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid) ' +
      'AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a<%= schemaJoin%> ' +
      'WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND ' +
      "t.relkind = 'r' and t.relname = '<%= tableName %>'<%= schemaWhere%> " +
      'GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;';

    return Utils._.template(query)({tableName: tableName, schemaJoin: schemaJoin, schemaWhere: schemaWhere});
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

  addLimitAndOffset: function(options) {
    var fragment = '';
    /*jshint eqeqeq:false*/
    if (options.limit != null) {
      fragment += ' LIMIT ' + this.escape(options.limit);
    }
    if (options.offset != null) {
       fragment += ' OFFSET ' + this.escape(options.offset);
    }

    return fragment;
  },

  attributeToSQL: function(attribute) {
    if (!Utils._.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }

    var template = '<%= type %>'
      , replacements = {};

    if (attribute.type instanceof DataTypes.ENUM) {
      if (attribute.type.values && !attribute.values) attribute.values = attribute.type.values;

      if (Array.isArray(attribute.values) && (attribute.values.length > 0)) {
        replacements.type = 'ENUM(' + Utils._.map(attribute.values, function(value) {
          return this.escape(value);
        }.bind(this)).join(', ') + ')';
      } else {
        throw new Error("Values for ENUM haven't been defined.");
      }
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
      attribute = Utils.formatReferences(attribute);
      template += ' REFERENCES <%= referencesTable %> (<%= referencesKey %>)';
      replacements.referencesTable = this.quoteTable(attribute.references.model);

      if (attribute.references.key) {
        replacements.referencesKey = this.quoteIdentifiers(attribute.references.key);
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

      if (attribute.references.deferrable) {
        template += ' <%= deferrable %>';
        replacements.deferrable = attribute.references.deferrable.toString(this);
      }
    }

    return  Utils._.template(template)(replacements);
  },

  deferConstraintsQuery: function (options) {
    return options.deferrable.toString(this);
  },

  setConstraintQuery: function (columns, type) {
    var columnFragment = 'ALL';

    if (columns) {
      columnFragment = columns.map(function (column) {
        return this.quoteIdentifier(column);
      }.bind(this)).join(', ');
    }

    return 'SET CONSTRAINTS ' + columnFragment + ' ' + type;
  },

  setDeferredQuery: function (columns) {
    return this.setConstraintQuery(columns, 'DEFERRED');
  },

  setImmediateQuery: function (columns) {
    return this.setConstraintQuery(columns, 'IMMEDIATE');
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
        , 'RETURNS <%= returnType %> AS $func$'
        , 'BEGIN'
        , '\t<%= body %>'
        , 'END;'
        , "$func$ language '<%= language %>'<%= options %>;"
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
    return eventSpecifier === 'after_constraint' ? 'CONSTRAINT ' : '';
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

  pgEnumName: function (tableName, attr, options) {
    options = options || {};
    var tableDetails = this.extractTableDetails(tableName, options)
      , enumName = '"enum_' + tableDetails.tableName + '_' + attr + '"';

    // pgListEnums requires the enum name only, without the schema
    if (options.schema !== false && tableDetails.schema) {
      enumName = this.quoteIdentifier(tableDetails.schema) + tableDetails.delimiter + enumName;
    }

    return enumName;

  },

  pgListEnums: function(tableName, attrName, options) {
    var enumName = ''
      , tableDetails = this.extractTableDetails(tableName, options);

    if (tableDetails.tableName && attrName) {
      enumName = ' AND t.typname=' + this.pgEnumName(tableDetails.tableName, attrName, { schema: false }).replace(/"/g, "'");
    }

    var query = 'SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value FROM pg_type t ' +
      'JOIN pg_enum e ON t.oid = e.enumtypid ' +
      'JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace ' +
      "WHERE n.nspname = '" + tableDetails.schema + "'" + enumName + ' GROUP BY 1';

    return query;
  },

  pgEnum: function(tableName, attr, dataType, options) {
    var enumName = this.pgEnumName(tableName, attr, options)
      , values;

    if (dataType.values) {
      values = "ENUM('" + dataType.values.join("', '") + "')";
    } else {
      values = dataType.toString().match(/^ENUM\(.+\)/)[0];
    }

    var sql = 'CREATE TYPE ' + enumName + ' AS ' + values + ';';
    if (!!options && options.force === true) {
      sql = this.pgEnumDrop(tableName, attr) + sql;
    }
    return sql;
  },

  pgEnumAdd: function(tableName, attr, value, options) {
    var enumName = this.pgEnumName(tableName, attr)
      , sql = 'ALTER TYPE ' + enumName + ' ADD VALUE ';

    if (semver.gte(this.sequelize.options.databaseVersion, '9.3.0')) {
      sql += 'IF NOT EXISTS ';
    }
    sql += this.escape(value);

    if (!!options.before) {
      sql += ' BEFORE ' + this.escape(options.before);
    } else if (!!options.after) {
      sql += ' AFTER ' + this.escape(options.after);
    }

    return sql;
  },

  pgEnumDrop: function(tableName, attr, enumName) {
    enumName = enumName || this.pgEnumName(tableName, attr);
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

  dataTypeMapping: function(tableName, attr, dataType) {
    if (Utils._.includes(dataType, 'PRIMARY KEY')) {
      dataType = dataType.replace(/PRIMARY KEY/, '');
    }

    if (Utils._.includes(dataType, 'SERIAL')) {
      if (Utils._.includes(dataType, 'BIGINT')) {
        dataType = dataType.replace(/SERIAL/, 'BIGSERIAL');
        dataType = dataType.replace(/BIGINT/, '');
      } else {
        dataType = dataType.replace(/INTEGER/, '');
      }
      dataType = dataType.replace(/NOT NULL/, '');
    }

    if (dataType.match(/^ENUM\(/)) {
      dataType = dataType.replace(/^ENUM\(.+\)/, this.pgEnumName(tableName, attr));
    }

    return dataType;
  },

  quoteIdentifier: function(identifier, force) {
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
  /**
   * Generates an SQL query that returns all foreign keys of a table.
   *
   * @param  {String} tableName  The name of the table.
   * @param  {String} schemaName The name of the schema.
   * @return {String}            The generated sql query.
   */
  getForeignKeysQuery: function(tableName, schemaName) {
    return 'SELECT conname as constraint_name, pg_catalog.pg_get_constraintdef(r.oid, true) as condef FROM pg_catalog.pg_constraint r ' +
      "WHERE r.conrelid = (SELECT oid FROM pg_class WHERE relname = '" + tableName + "' LIMIT 1) AND r.contype = 'f' ORDER BY 1;";
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
  },


  setAutocommitQuery: function(value, options) {
    if (options.parent) {
      return;
    }

    // POSTGRES does not support setting AUTOCOMMIT = OFF as of 9.4.0
    // Additionally it does not support AUTOCOMMIT at all starting at v9.5
    // The assumption is that it won't be returning in future versions either
    // If you are on a Pg version that is not semver compliant e.g. '9.5.0beta2', which fails due to the 'beta' qualification, then you need to pass
    // the database version as "9.5.0" explicitly through the options param passed when creating the Sequelize instance under the key "databaseVersion"
    // otherwise Pg version "9.4.0" is assumed by default as per Sequelize 3.14.2.
    // For Pg versions that are semver compliant, this is auto-detected upon the first connection.
    if (!value || semver.gte(this.sequelize.options.databaseVersion, '9.4.0')) {
      return;
    }

    return AbstractQueryGenerator.setAutocommitQuery.call(this, value, options);
  }
};

module.exports = Utils._.extend(Utils._.clone(AbstractQueryGenerator), QueryGenerator);
