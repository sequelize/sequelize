import { AbstractQuery } from '../abstract/query';
import _ from 'lodash';
import logger from '../../utils/logger';
import sequelizeErrors from '../../errors';
import { defaults, flattenObjectDeep, cloneDeep } from '../../utils/object';
import { intersects } from '../../utils/array';

export class CockroachDbQuery extends AbstractQuery {
  constructor() {
    super();

    this.model.findOrCreate = async options => {

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
          logger.warn(
            `Unknown attributes (${unknownDefaults}) passed to defaults option of findOrCreate`,
          );
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

        const found = await this.findOne(defaults({ transaction }, options));
        if (found !== null) {
          return [found, false];
        }

        values = { ...options.defaults };
        if (_.isPlainObject(options.where)) {
          values = defaults(values, options.where);
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

          const flattenedWhere = flattenObjectDeep(options.where);
          const flattenedWhereKeys = Object.keys(flattenedWhere).map(name => _.last(name.split('.')));
          const whereFields = flattenedWhereKeys.map(name => _.get(this.rawAttributes, `${name}.field`, name));
          const defaultFields = options.defaults
            && Object.keys(options.defaults)
              .filter(name => this.rawAttributes[name])
              .map(name => this.rawAttributes[name].field || name);

          // This line differs from the original findOrCreate. Added {} to bypass the .fields requesting.
          // This issue: https://github.com/cockroachdb/cockroach/issues/63332 could probably change the
          // need for this adaptation.
          const errFieldKeys = Object.keys(error.fields || {});
          const errFieldsWhereIntersects = intersects(
            errFieldKeys,
            whereFields,
          );
          if (
            defaultFields
            && !errFieldsWhereIntersects
            && intersects(errFieldKeys, defaultFields)
          ) {
            throw error;
          }

          if (errFieldsWhereIntersects) {
            _.each(error.fields, (value, key) => {
              const name = this.fieldRawAttributesMap[key].fieldName;
              if (value.toString() !== options.where[name].toString()) {
                throw new Error(
                  `${this.name}#findOrCreate: value used for ${name} was not equal for both the find and the create calls, '${options.where[name]}' vs '${value}'`,
                );
              }
            });
          }

          // Someone must have created a matching instance inside the same transaction since we last did a find. Let's find it!
          const otherCreated = await this.findOne(
            defaults(
              {
                transaction: internalTransaction ? null : transaction,
              },
              options,
            ),
          );

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

    this.model.findByPk = async (param, options) => {
      // return Promise resolved with null if no arguments are passed
      if ([null, undefined].includes(param)) {
        return null;
      }

      options = cloneDeep(options) || {};

      if (
        ['number', 'string', 'bigint'].includes(typeof param) || Buffer.isBuffer(param)
      ) {
        options.where = {
          [this.primaryKeyAttribute]: param,
        };
      } else {
        throw new Error(`Argument passed to findByPk is invalid: ${param}`);
      }

      // Bypass a possible overloaded findOne
      return await this.findOne(options);

    };
  }
}
