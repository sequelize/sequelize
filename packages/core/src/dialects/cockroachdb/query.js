import { PostgresQuery } from '../postgres/query';
import _ from 'lodash';
import * as sequelizeErrors from '../../errors';

export class CockroachDbQuery extends PostgresQuery {
  async run(sql, parameters, options) {

    const rows = await super.run(sql, parameters, options);

    if (this.isShowIndexesQuery()) {
      for (const row of rows) {
        let attributes;
        let includeColumns = [];
        if (/storing \(([^]*)\)/gi.test(row.definition)) {
          attributes = /on .*? (?:using .*?\s)?\(([^]*)\) storing \(([^]*)\)/gi.exec(row.definition)[1].split(',');
          includeColumns = /on .*? (?:using .*?\s)?\(([^]*)\) storing \(([^]*)\)/gi.exec(row.definition)[2].split(',');
        } else {
          attributes = /on .*? (?:using .*?\s)?\(([^]*)\)/gi.exec(row.definition)[1].split(',');
        }

        let attribute;

        const indkeys = row.indkey.split(' ');
        row.fields = indkeys.slice(0, indkeys.length - includeColumns.length).map((_indKey, index) => {
          attribute = attributes[index];

          return {
            ...row.fields[index],
            collate: /COLLATE "(.*?)"/.test(attribute) ? /COLLATE "(.*?)"/.exec(attribute)[1] : undefined,
            order: attribute?.includes('DESC') ? 'DESC' : attribute?.includes('ASC') ? 'ASC' : undefined,
          };
        }).filter(n => n !== null);
        delete row.columns;
      }

      return rows;
    }

    return rows;

  }

  formatError(err) {
    const code = err.code || err.sqlState;
    const errDetail = err.detail || err.messageDetail;
    let match;

    if (code === '23505' && errDetail && (match = errDetail.replace(/["']/g, '').match(/Key \((.*?)\)=\((.*?)\)/))) {
      const fields = _.zipObject(match[1].split(','), match[2].split(','));
      const errors = [];
      let message = 'Validation error';

      _.forOwn(fields, (value, field) => {
        errors.push(new sequelizeErrors.ValidationErrorItem(
          this.getUniqueConstraintErrorMessage(field),
          'unique violation', // sequelizeErrors.ValidationErrorItem.Origins.DB,
          field,
          value,
          this.instance,
          'not_unique',
        ));
      });

      if (this.model) {
        for (const index of this.model.getIndexes()) {
          if (index.unique && _.isEqual(index.fields, Object.keys(fields)) && index.msg) {
            message = index.msg;
            break;
          }
        }
      }

      return new sequelizeErrors.UniqueConstraintError({ message, errors, cause: err, fields });
    }

    return super.formatError(err);

  }
}
