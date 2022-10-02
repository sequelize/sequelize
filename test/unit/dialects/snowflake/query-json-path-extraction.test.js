'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { SnowflakeQueryGenerator: QueryGenerator } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/snowflake/query-generator.js');

describe('[SNOWFLAKE Specific] jsonPathExtractionQuery', () => {
  if (dialect !== 'snowflake') {
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
