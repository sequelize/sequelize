if(typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../index")
      , Helpers   = require('./buster-helpers')
      , dialect   = Helpers.getTestDialect()
}

buster.spec.expose()

describe(Helpers.getTestDialectTeaser('Data types'), function() {
  it('should return DECIMAL for the default decimal type', function() {
    expect(Sequelize.DECIMAL).toEqual('DECIMAL');
  });

  it('should return DECIMAL(10,2) for the default decimal type with arguments', function() {
    expect(Sequelize.DECIMAL(10, 2)).toEqual('DECIMAL(10,2)');
  });
});
