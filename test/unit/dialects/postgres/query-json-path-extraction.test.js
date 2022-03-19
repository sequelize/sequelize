'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const QueryGenerator = require('@sequelize/core/lib/dialects/postgres/query-generator');

if (dialect === 'postgres') {
  describe('[POSTGRES Specific] jsonPathExtractionQuery', () => {
    let queryGenerator;
    beforeEach(function () {
      queryGenerator = new QueryGenerator({
        sequelize: this.sequelize,
        _dialect: this.sequelize.dialect,
      });
    });

    it('should handle isJson parameter true', async () => {
      expect(queryGenerator.jsonPathExtractionQuery('profile', 'id', true)).to.equal('("profile"#>\'{id}\')');
    });

    it('should use default handling if isJson is false', async () => {
      expect(queryGenerator.jsonPathExtractionQuery('profile', 'id', false)).to.equal('("profile"#>>\'{id}\')');
    });

    it('Should use default handling if isJson is not passed', async () => {
      expect(queryGenerator.jsonPathExtractionQuery('profile', 'id')).to.equal('("profile"#>>\'{id}\')');
    });
  });
}
