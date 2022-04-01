'use strict';

const PostgresDialect = require('../postgres/index');
const ConnectionManager = require('./connection-manager');
const Query = require('./query');
const Model = require('../../model');
const DataTypes = require('../../data-types').yugabyte;
const QueryGenerator = require('./query-generator');
const { YugabyteQueryInterface } = require('./query-interface');
const _ = require('lodash');
const Utils = require('../../utils');
const { logger } = require('../../utils/logger');
const sequelizeErrors = require('../../errors');

class YugabyteDialect extends PostgresDialect {
  static supports = _.merge(_.cloneDeep(PostgresDialect.supports), {});

  constructor(sequelize) {
    super(sequelize);
    this.sequelize = sequelize;
    this.DataTypes = DataTypes;
    this.connectionManager = new ConnectionManager(this, sequelize);
    this.queryGenerator = new QueryGenerator({
      _dialect: this,
      sequelize,
    });
    this.queryInterface = new YugabyteQueryInterface(
      sequelize,
      this.queryGenerator,
    );

    Model.findOrCreate = async function findOrCreate(options) {
      if (!options || !options.where || arguments.length > 1) {
        throw new Error(
          'Missing where attribute in the options parameter passed to findOrCreate. '
              + 'Please note that the API has changed, and is now options only (an object with where, defaults keys, transaction etc.)',
        );
      }

      options = { ...options };

      if (options.defaults) {
        const defaults = Object.keys(options.defaults);
        const unknownDefaults = defaults.filter(name => !this.rawAttributes[name]);

        if (unknownDefaults.length) {
          logger.warn(`Unknown attributes (${unknownDefaults}) passed to defaults option of findOrCreate`);
        }
      }

      if (options.transaction === undefined && this.sequelize.constructor._cls) {
        const t = this.sequelize.constructor._cls.get('transaction');
        if (t) {
          options.transaction = t;
        }
      }

      const internalTransaction = !options.transaction;
      let values;
      let transaction;

      try {
        const t = await this.sequelize.transaction(options);
        transaction = t;
        options.transaction = t;

        const found = await this.findOne(Utils.defaults({ transaction }, options));
        if (found !== null) {
          return [found, false];
        }

        values = { ...options.defaults };
        if (_.isPlainObject(options.where)) {
          values = Utils.defaults(values, options.where);
        }

        options.exception = true;
        options.returning = true;

        try {
          const created = await this.create(values, options);
          if (created.get(this.primaryKeyAttribute, { raw: true }) === null) {
            // If the query returned an empty result for the primary key, we know that this was actually a unique constraint violation
            throw new sequelizeErrors.UniqueConstraintError();
          }

          return [created, true];
        } catch (error) {
          if (!(error instanceof sequelizeErrors.UniqueConstraintError)) {
            throw error;
          }

          const flattenedWhere = Utils.flattenObjectDeep(options.where);
          const flattenedWhereKeys = Object.keys(flattenedWhere).map(name => _.last(name.split('.')));
          const whereFields = flattenedWhereKeys.map(name => _.get(this.rawAttributes, `${name}.field`, name));
          const defaultFields = options.defaults && Object.keys(options.defaults)
            .filter(name => this.rawAttributes[name])
            .map(name => this.rawAttributes[name].field || name);

          // YugabyteDB related changes are done at this point for errFieldsKeys variable
          let errFieldKeys = [];
          if (error.fields !== undefined) {
            errFieldKeys = Object.keys(error.fields);
          }

          const errFieldsWhereIntersects = Utils.intersects(errFieldKeys, whereFields);
          if (defaultFields && !errFieldsWhereIntersects && Utils.intersects(errFieldKeys, defaultFields)) {
            throw error;
          }

          if (errFieldsWhereIntersects) {
            _.each(error.fields, (value, key) => {
              const name = this.fieldRawAttributesMap[key].fieldName;
              if (value.toString() !== options.where[name].toString()) {
                throw new Error(`${this.name}#findOrCreate: value used for ${name} was not equal for both the find and the create calls, '${options.where[name]}' vs '${value}'`);
              }
            });
          }

          // Someone must have created a matching instance inside the same transaction since we last did a find. Let's find it!
          const otherCreated = await this.findOne(Utils.defaults({
            transaction: internalTransaction ? null : transaction,
          }, options));

          // Sanity check, ideally we caught this at the defaultFeilds/err.fields check
          // But if we didn't and instance is null, we will throw
          if (otherCreated === null) {
            throw error;
          }

          return [otherCreated, false];
        }
      } finally {
        if (internalTransaction && transaction) {
          await transaction.commit();
        }
      }
    };
  }

}

// YugabyteDialect.prototype.defaultVersion = '2.11.1.0-b305 '; // minimum supported version
YugabyteDialect.prototype.Query = Query;
YugabyteDialect.prototype.DataTypes = DataTypes;
YugabyteDialect.prototype.name = 'yugabyte';

YugabyteDialect.prototype.TICK_CHAR = '"';
YugabyteDialect.prototype.TICK_CHAR_LEFT = YugabyteDialect.prototype.TICK_CHAR;
YugabyteDialect.prototype.TICK_CHAR_RIGHT = YugabyteDialect.prototype.TICK_CHAR;

module.exports = YugabyteDialect;
module.exports.default = YugabyteDialect;
module.exports.YugabyteDialect = YugabyteDialect;
