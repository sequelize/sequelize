'use strict';

const chai = require('chai'),
  expect = chai.expect,
  QuoteHelper = require('../../../../lib/dialects/abstract/query-generator/helpers/quote'),
  Sequelize = require('../../../../index');

describe('QuoteIdentifier', () => {
  it('unknown dialect', () => {
    expect(
      QuoteHelper.quoteIdentifier.bind(this, 'unknown', 'id', {})).to.throw(
      Error);
  });

  describe('Non-literal identifiers', () => {
    it('should allow literal identifier in sqlite', () => {
      const identifier = QuoteHelper.quoteIdentifier('sqlite', 'example');

      identifier.should.equal('`example`');
    });

    it('should allow literal identifier in mariadb', () => {
      const identifier = QuoteHelper.quoteIdentifier('mariadb', 'example');

      identifier.should.equal('`example`');
    });

    it('should allow literal identifier in mysql', () => {
      const identifier = QuoteHelper.quoteIdentifier('mysql', 'example');

      identifier.should.equal('`example`');
    });

    it('should allow literal identifier in postgres', () => {
      const identifier = QuoteHelper.quoteIdentifier('postgres', 'example');

      identifier.should.equal('"example"');
    });

    it('should allow literal identifier in mssql', () => {
      const identifier = QuoteHelper.quoteIdentifier('mssql', 'example');

      identifier.should.equal('[example]');
    });
  });

  describe('Literal identifiers', () => {
    const literalIdentifier = [
      Sequelize.literal('PGP_SYM_DECRYPT(CAST(example AS BYTEA), \'SUPER_SECRET_KEY\')'),
      'example'
    ];

    it('should allow literal identifier in sqlite', () => {
      const identifier = QuoteHelper.quoteIdentifier('sqlite', literalIdentifier);

      identifier.should.equal("PGP_SYM_DECRYPT(CAST(example AS BYTEA), 'SUPER_SECRET_KEY') AS `example`");
    });

    it('should allow literal identifier in mariadb', () => {
      const identifier = QuoteHelper.quoteIdentifier('mariadb', literalIdentifier);

      identifier.should.equal("PGP_SYM_DECRYPT(CAST(example AS BYTEA), 'SUPER_SECRET_KEY') AS `example`");
    });

    it('should allow literal identifier in mysql', () => {
      const identifier = QuoteHelper.quoteIdentifier('mysql', literalIdentifier);

      identifier.should.equal("PGP_SYM_DECRYPT(CAST(example AS BYTEA), 'SUPER_SECRET_KEY') AS `example`");
    });

    it('should allow literal identifier in postgres', () => {
      const identifier = QuoteHelper.quoteIdentifier('postgres', literalIdentifier);

      identifier.should.equal("PGP_SYM_DECRYPT(CAST(example AS BYTEA), 'SUPER_SECRET_KEY') AS \"example\"");
    });

    it('should allow literal identifier in mssql', () => {
      const identifier = QuoteHelper.quoteIdentifier('mssql', literalIdentifier);

      identifier.should.equal("PGP_SYM_DECRYPT(CAST(example AS BYTEA), 'SUPER_SECRET_KEY') AS [example]");
    });
  });
});
