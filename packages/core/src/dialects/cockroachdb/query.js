import { PostgresQuery } from '../postgres/query';

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
}
