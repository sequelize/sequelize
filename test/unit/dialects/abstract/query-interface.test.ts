import { expect } from 'chai';
import Support from '../../support';

const { sequelize } = Support as any;

describe('QueryInterface', () => {
  describe('quoteIdentifier', () => {
    // regression test which covers https://github.com/sequelize/sequelize/issues/12627
    it('should quote the identifier', () => {
      const identifier = 'identifier';
      const quotedIdentifier = sequelize
        .getQueryInterface()
        .quoteIdentifier(identifier);
      const expectedQuotedIdentifier = sequelize
        .getQueryInterface()
        .queryGenerator.quoteIdentifier(identifier);

      expect(quotedIdentifier).not.to.be.undefined;
      expect(expectedQuotedIdentifier).not.to.be.undefined;
      expect(quotedIdentifier).to.equal(expectedQuotedIdentifier);
    });
  });

  describe('quoteIdentifiers', () => {
    // regression test which covers https://github.com/sequelize/sequelize/issues/12627
    it('should quote the identifiers', () => {
      const identifier = 'table.identifier';
      const quotedIdentifiers = sequelize
        .getQueryInterface()
        .quoteIdentifiers(identifier);
      const expectedQuotedIdentifiers = sequelize
        .getQueryInterface()
        .queryGenerator.quoteIdentifiers(identifier);

      expect(quotedIdentifiers).not.to.be.undefined;
      expect(expectedQuotedIdentifiers).not.to.be.undefined;
      expect(quotedIdentifiers).to.equal(expectedQuotedIdentifiers);
    });
  });
});
