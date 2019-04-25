'use strict';


const sqlString = require('../../../lib/sql-string'),
  chai = require('chai'),
  expect = chai.expect;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe('Test sql-string', () => {
  describe('function formatNamedParameters', () => {
    it('Valid fail for missing replacement key', () => {
      expect(() => {
        sqlString.formatNamedParameters('SELECT * FROM "_Join:roles:_Role" WHERE "owningId" = :owningId', { owningId: 'xxx' });
      }).to.throw(Error, 'Named parameter ":roles" has no value in the given object.');
    });

    it('Returns SQL query for liberalReplace', () => {
      expect(sqlString.formatNamedParameters('SELECT * FROM "_Join:roles:_Role" WHERE "owningId" = :owningId', { owningId: 'xxx' }, undefined, undefined, true)).to
        .equal('SELECT * FROM "_Join:roles:_Role" WHERE "owningId" = \'xxx\'');
    });
  });
});
