import { expect } from 'chai';
import { sequelize } from '../../support';

describe('QueryInterface#quoteIdentifier', () => {
  // regression test which covers https://github.com/sequelize/sequelize/issues/12627
  it('should quote the identifier', () => {
    const identifier = 'identifier';
    const quotedIdentifier = sequelize.queryInterface.quoteIdentifier(identifier);
    const expectedQuotedIdentifier =
      sequelize.queryInterface.queryGenerator.quoteIdentifier(identifier);

    expect(quotedIdentifier).not.to.be.undefined;
    expect(expectedQuotedIdentifier).not.to.be.undefined;
    expect(quotedIdentifier).to.equal(expectedQuotedIdentifier);
  });
});
