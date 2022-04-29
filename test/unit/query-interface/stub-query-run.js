const sinon = require('sinon');
const { sequelize } = require('../../support');

module.exports.stubQueryRun = function stubQueryRun() {
  let lastExecutedSql;

  class FakeQuery {
    run(sql) {
      lastExecutedSql = sql;

      return [];
    }
  }

  sinon.stub(sequelize.dialect, 'Query').get(() => FakeQuery);
  sinon.stub(sequelize.connectionManager, 'getConnection').returns({});
  sinon.stub(sequelize.connectionManager, 'releaseConnection');

  return () => {
    return lastExecutedSql;
  };
};
