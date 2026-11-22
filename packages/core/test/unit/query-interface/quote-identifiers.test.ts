import { expect } from 'chai';
import { sequelize } from '../../support';

describe('QueryInterface#quoteIdentifiers', () => {
  // regression test which covers https://github.com/sequelize/sequelize/issues/12627
  it('should quote the identifiers', () => {
    const identifier = 'table.identifier';
    const quotedIdentifiers = sequelize.queryInterface.quoteIdentifiers(identifier);
    const expectedQuotedIdentifiers =
      sequelize.queryInterface.queryGenerator.quoteIdentifiers(identifier);

    expect(quotedIdentifiers).not.to.be.undefined;
    expect(expectedQuotedIdentifiers).not.to.be.undefined;
    expect(quotedIdentifiers).to.equal(expectedQuotedIdentifiers);
  });
});
