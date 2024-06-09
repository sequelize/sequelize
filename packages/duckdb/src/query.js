'use strict';

import {
  AbstractQuery,
} from '@sequelize/core';

export class DuckDbQuery extends AbstractQuery {
  constructor(connection, sequelize, options) {
    super(connection, sequelize, { showWarnings: false, ...options });
  }

  async run(sql, parameters) {
    const data = await this.connection.all(sql, parameters);
    if (this.isSelectQuery()) {
      return this.handleSelectQuery(data);
    }

    return data;
  }
}
