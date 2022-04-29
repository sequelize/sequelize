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

  return () => {
    return lastExecutedSql;
  };
};
