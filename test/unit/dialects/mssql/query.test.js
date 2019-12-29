'use strict';

const path = require('path');
const Query = require(path.resolve('./lib/dialects/mssql/query.js'));
const Support = require(__dirname + '/../../support');
const dialect = Support.getTestDialect();
const sequelize = Support.sequelize;
const sinon = require('sinon');
const expect = require('chai').expect;
const tedious = require('tedious');
const tediousIsolationLevel = tedious.ISOLATION_LEVEL;
const connectionStub = { beginTransaction: () => {}, lib: tedious };

let sandbox, query;

if (dialect === 'mssql') {
  describe('[MSSQL Specific] Query', () => {
    describe('beginTransaction', () => {
      beforeEach(() => {
        sandbox = sinon.sandbox.create();
        const options = {
          transaction: { name: 'transactionName' },
          isolationLevel: 'REPEATABLE_READ',
          logging: false
        };
        sandbox.stub(connectionStub, 'beginTransaction').callsFake(cb => {
          cb();
        });
        query = new Query(connectionStub, sequelize, options);
      });

      it('should call beginTransaction with correct arguments', () => {
        return query._run(connectionStub, 'BEGIN TRANSACTION')
          .then(() => {
            expect(connectionStub.beginTransaction.called).to.equal(true);
            expect(connectionStub.beginTransaction.args[0][1]).to.equal('transactionName');
            expect(connectionStub.beginTransaction.args[0][2]).to.equal(tediousIsolationLevel.REPEATABLE_READ);
          });
      });

      afterEach(() => {
        sandbox.restore();
      });
    });

    describe('formatBindParameters', () => {
      it('should convert Sequelize named binding format to MSSQL format', () => {
        const sql = 'select $one as a, $two as b, $one as c, $three as d, $one as e';
        const values = { one: 1, two: 2, three: 3 };

        const expected = 'select @one as a, @two as b, @one as c, @three as d, @one as e';

        const result = Query.formatBindParameters(sql, values, dialect);
        expect(result[0]).to.be.a('string');
        expect(result[0]).to.equal(expected);
      });

      it('should convert Sequelize numbered binding format to MSSQL format', () => {
        const sql = 'select $1 as a, $2 as b, $1 as c, $3 as d, $1 as e';
        const values = [1, 2, 3];

        const expected = 'select @0 as a, @1 as b, @0 as c, @2 as d, @0 as e';

        const result = Query.formatBindParameters(sql, values, dialect);
        expect(result[0]).to.be.a('string');
        expect(result[0]).to.equal(expected);
      });
    });
  });
}
