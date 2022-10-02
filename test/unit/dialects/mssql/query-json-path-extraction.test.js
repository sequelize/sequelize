'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { MsSqlQueryGenerator: QueryGenerator } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/mssql/query-generator.js');

describe('[MSSQL Specific] jsonPathExtractionQuery', () => {
  if (dialect !== 'mssql') {
    return;
  }

  let queryGenerator;
  beforeEach(function () {
    queryGenerator = new QueryGenerator({
      sequelize: this.sequelize,
      _dialect: this.sequelize.dialect,
    });
  });

  it('should handle isJson parameter true', async () => {
    expect(() => queryGenerator.jsonPathExtractionQuery('profile', 'id', true)).to.throw(Error);
  });

  it('should use default handling if isJson is false', async () => {
    expect(() => queryGenerator.jsonPathExtractionQuery('profile', 'id', false)).to.throw(Error);
  });

  it('Should use default handling if isJson is not passed', async () => {
    expect(() => queryGenerator.jsonPathExtractionQuery('profile', 'id')).to.throw(Error);
  });
});
