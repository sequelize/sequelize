'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  QueryGenerator = require('sequelize/lib/dialects/db2/query-generator');

if (dialect === 'db2') {
  describe('[DB2 Specific] jsonPathExtractionQuery', () => {
    let queryGenerator;
    beforeEach(function() {
      queryGenerator = new QueryGenerator({
        sequelize: this.sequelize,
        _dialect: this.sequelize.dialect
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
}
