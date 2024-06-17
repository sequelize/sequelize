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

    console.log("DUCKDB RUN; db path " + this.connection.db_path + "; sql = " + sql);

    var data;
    if (parameters) {
      data = await this.connection.db.all(sql, ...parameters);
    } else {
      data = await this.connection.db.all(sql);
    }

    let result = this.instance;
    if (this.isSelectQuery()) {
      //console.log("*** SELECT Query: ", sql, "params: ", parameters);

      return this.handleSelectQuery(data);
    }

    const metadata = {};
    if (this.isInsertQuery(data, metadata) || this.isUpsertQuery()) {
      console.log("*** INSERT/upsert query: " + sql);

      this.handleInsertQuery(data, metadata);

      console.log("**** INSERT QUERY; GOT DATA: ", data);

      if (!this.instance) {
        console.log("***** WHY IS THERE NO INSTANCE? ******");
      } else {
        // why are there multiple rows?
        console.log("*** NORMAL ID AUTOGENERATION");
        //result = data[this.getInsertIdField()];
        for (const column of Object.keys(data[0])) {
          console.log("*** NORMAL ID AUTOGENERATION: setting column " + column + " to value " + data[0][column]);
          this.instance.set(column, data[0][column], {
            raw: true,
            comesFromDatabase: true,
          });
        }
      }

      console.log("**** INSERT QUERY; INSTANCE: ", this.instance);


      // TBD: second parameter is number of affected rows
      return [result, metadata];

    }

    if (this.isRawQuery()) {
      //console.log("*** raw query..." + sql);
      return [data, data];
    }


    if (this.isShowConstraintsQuery()) {
      //console.log("*** show constraints..." + sql);
      //console.log("*** show constraints...");
      return data;
    }

    if (this.isShowIndexesQuery()) {
      //console.log("*** show indexes..." + sql);
     // console.log("*** show indexes...");
      return data;
    }

    // TBD: return number of rows updated
    if (this.isBulkUpdateQuery() || this.isDeleteQuery()) {
      return 0;
    }

    console.log("SOMETHING UNIMPLEMENTED: " + this.options.type);

    return [data, data];
  }
}
