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

    if (sql.startsWith("DROP TABLE")) {
      const sequence_prefix = sql.match(/^DROP TABLE IF EXISTS "([^ ]+)"/)[1]
          .replaceAll('.', '_')
          .replaceAll('"', '');

      const sequences = [];
      // clean up all the table's sequences
      sequences.push(this.connection.connection.all(
          "SELECT sequence_name FROM duckdb_sequences() WHERE starts_with(sequence_name, ?)",
          sequence_prefix
      ).then(seqResult => {
        return seqResult;
      }));

      return Promise.all(
        sequences.map(seqPromise => seqPromise.then(sequence => {
          if (sequence && sequence.length > 0 && "sequence_name" in sequence[0]) {
            //console.log("*** dropping sequence ", "DROP SEQUENCE " + sequence[0].sequence_name + " CASCADE");
            return this.connection.connection.all("DROP SEQUENCE " + sequence[0].sequence_name + " CASCADE");
          }

          return Promise.resolve();
        }))
      ).then(() => this.runQueryInternal(sql, parameters));
    }

    return this.runQueryInternal(sql, parameters);
  }

  async runQueryInternal(sql, parameters) {
    //console.log("*** QUERY: ", sql);
    let dataPromise;
    if (parameters) {
      dataPromise = this.connection.connection.all(sql, ...parameters);
    } else {
      dataPromise = this.connection.connection.all(sql);
    }

    if (this.isSelectQuery()) {
      // console.log("*** SELECT Query: ", sql, "params: ", parameters);
      // console.log("results: ", data);
      return dataPromise.then(data => this.handleSelectQuery(data));
    }

    return dataPromise.then(data => this.processResults(data));
  }

  // TBD: comment better; no longer async
  processResults(data) {
    const metadata = {};
    const result = this.instance;

    if (this.isInsertQuery(data, metadata) || this.isUpsertQuery()) {
      // console.log("*** INSERT/upsert query: " + sql);

      this.handleInsertQuery(data, metadata);

      // console.log("**** INSERT QUERY; GOT DATA: ", data);

      if (!this.instance) {
        //console.log("***** WHY IS THERE NO INSTANCE? ******");
      } else {
        // why are there multiple rows?
        //console.log("*** NORMAL ID AUTOGENERATION");
        //result = data[this.getInsertIdField()];
        for (const column of Object.keys(data[0])) {
          //console.log("*** NORMAL ID AUTOGENERATION: setting column " + column + " to value " + data[0][column]);
          this.instance.set(column, data[0][column], {
            raw: true,
            comesFromDatabase: true,
          });
        }
      }

      // console.log("**** INSERT QUERY; INSTANCE: ", this.instance);


      // TBD: second parameter is number of affected rows
      return [result, metadata];

    }

    if (this.isRawQuery()) {
      // console.log("*** raw query..." + sql + "; data = ", data);

      return [data, data];
    }

    if (this.isShowConstraintsQuery()) {
      // console.log("*** show constraints..." + sql);
      // console.log("*** show constraints...");
      return data;
    }

    if (this.isShowIndexesQuery()) {
      // console.log("*** show indexes..." + sql);
      // console.log("*** show indexes...");
      return data;
    }

    // TBD: return number of rows updated
    if (this.isBulkUpdateQuery() || this.isDeleteQuery()) {
      return 0;
    }


    // console.log("SOMETHING UNIMPLEMENTED: " + this.options.type);

    return [data, data];
  }
}
