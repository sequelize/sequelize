'use strict';

import {
  AbstractQuery,
} from '@sequelize/core';

export class DuckDbQuery extends AbstractQuery {
  constructor(connection, sequelize, options) {
    super(connection, sequelize, { showWarnings: false, ...options });
  }

  async run(sql, parameters) {
    this.sql = sql;

    var data;
    if (parameters) {
      data = await this.connection.db.all(sql, ...parameters);
    } else {
      data = await this.connection.db.all(sql);
    }

    let result = this.instance;
    if (this.isSelectQuery()) {
      console.log("*** SELECT Query: ", sql, "params: ", parameters);

      return this.handleSelectQuery(data);
    }

    const metadata = {};
    if (this.isInsertQuery(data, metadata) || this.isUpsertQuery()) {
      console.log("*** INSERT/upsert query: " + sql);

      this.handleInsertQuery(data, metadata);

      if (!this.instance) {
        const modelDefinition = this.model?.modelDefinition;

        // TBD: what?
        // handle bulkCreate AI primary key
        if (
            data.constructor.name === 'ResultSetHeader' &&
            modelDefinition?.autoIncrementAttributeName &&
            modelDefinition?.autoIncrementAttributeName === this.model.primaryKeyAttribute
        ) {
          console.log("*** WHAT IS BULK CREATE ***");
          const startId = data[this.getInsertIdField()];
          result = [];
          for (let i = startId; i < startId + data.affectedRows; i++) {
            result.push({ [modelDefinition.getColumnName(this.model.primaryKeyAttribute)]: i });
          }
        } else {
          console.log("*** NORMAL ID AUTOGENERATION");
          result = data[this.getInsertIdField()];
        }
      }

      // TBD: second parameter is number of affected rows
      return [result, metadata];

    }

    if (this.isRawQuery()) {
      console.log("*** raw query..." + sql);
      return [data, data];
    }


    if (this.isShowConstraintsQuery()) {
      console.log("*** show constraints..." + sql);
      return data;
    }

    if (this.isShowIndexesQuery()) {
      console.log("*** show indexes..." + sql);
      return data;
    }

    console.log("SOMETHING UNIMPLEMENTED: " + this.options.type);

    return [data, data];
  }
}
