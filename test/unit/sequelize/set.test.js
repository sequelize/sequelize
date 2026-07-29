'use strict';

const chai = require('chai');
const sinon = require('sinon');

const expect = chai.expect;
const Support = require('../../support');
const Sequelize = require('sequelize');

const Transaction = Sequelize.Transaction;
const dialect = Support.getTestDialect();

if (['mysql', 'mariadb'].includes(dialect)) {
  describe(`[${dialect.toUpperCase()}] Sequelize#set`, () => {
    const sequelize = Support.sequelize;

    let stub;
    beforeEach(() => {
      stub = sinon.stub(sequelize, 'query').resolves({});
    });

    afterEach(() => {
      sinon.restore();
    });

    // `set` builds a single SET statement, so an unescaped value can append further assignments
    // or subqueries without needing `multipleStatements`.
    const setVariables = async variables => {
      await sequelize.set(variables, { transaction: new Transaction(sequelize, {}) });

      return stub.getCall(0).args[0];
    };

    describe('values', () => {
      it('escapes a value that tries to append an assignment', async () => {
        const sql = await setVariables({
          foo: '", @is_admin := 1, @leak := (SELECT password FROM users LIMIT 1), @z := "'
        });

        expect(sql).to.equal(
          String.raw`SET @foo := '\", @is_admin := 1, @leak := (SELECT password FROM users LIMIT 1), @z := \"'`
        );
      });

      it('escapes apostrophes and backslashes', async () => {
        // A raw `'` would close the literal; a raw `\` would escape whatever follows it.
        const sql = await setVariables({ foo: "apostrophe ', backslash \\" });

        expect(sql).to.equal("SET @foo := 'apostrophe \\', backslash \\\\'");
      });

      it('rejects SQL expressions', async () => {
        await expect(
          sequelize.set(
            { foo: Sequelize.literal('(SELECT password FROM users LIMIT 1)') },
            { transaction: new Transaction(sequelize, {}) }
          )
        ).to.be.rejectedWith(TypeError, 'does not accept SQL expressions as variable values');
      });

      it('keeps non-string values inline', async () => {
        const sql = await setVariables({ num: 1, nil: null, bool: true });

        expect(sql).to.equal('SET @num := 1, @nil := NULL, @bool := true');
      });

      it('sets multiple variables', async () => {
        const sql = await setVariables({ foo: 'bar', foos: 'bars' });

        expect(sql).to.equal("SET @foo := 'bar', @foos := 'bars'");
      });
    });

    describe('names', () => {
      for (const name of ['foo', 'foo.bar', '$foo', 'foo_1', 'café']) {
        it(`accepts ${name}`, async () => {
          const sql = await setVariables({ [name]: 'bar' });

          expect(sql).to.equal(`SET @${name} := 'bar'`);
        });
      }

      for (const name of [
        'x:=(select username from Users limit 1);-- -',
        '@global.general_log_file',
        'my var',
        '`my var`',
        "'x'",
        '"x"',
        'foo\nbar',
        'foo\0bar',
        '',
        'f'.repeat(65)
      ]) {
        it(`rejects ${JSON.stringify(name)}`, async () => {
          await expect(
            sequelize.set({ [name]: 'bar' }, { transaction: new Transaction(sequelize, {}) })
          ).to.be.rejectedWith(TypeError, 'Invalid session variable name');

          expect(sequelize.query).not.to.have.been.called;
        });
      }
    });
  });
}
