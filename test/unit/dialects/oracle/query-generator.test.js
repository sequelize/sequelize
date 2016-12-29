'use strict';

/* jshint -W110 */
var Support = require(__dirname + '/../../support')
  , expectsql = Support.expectsql
  , current = Support.sequelize
  , QueryGenerator = require('../../../../lib/dialects/oracle/query-generator')
  , _ = require('lodash');

if (current.dialect.name === 'oracle') {
  describe('[ORACLE] QueryGenerator', function () {
    // Dialect would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
    QueryGenerator._dialect = current.dialect;

    it('createTable', function () {

      const shouldBe = 'CREATE TABLE toto (totoincde INTEGER, totoexcde NVARCHAR2(50), PRIMARY KEY (totoincde));'; 
      let result = QueryGenerator.createTableQuery({tableName: 'toto'},  {totoincde: 'INTEGER PRIMARY KEY', totoexcde: 'NVARCHAR2(50)'});
      expectsql(result, {
        oracle : shouldBe
      });
        
    });

  });

}
