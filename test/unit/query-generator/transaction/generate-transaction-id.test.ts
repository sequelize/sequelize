import { expect } from 'chai';
// @ts-expect-error - isUUID is not exported this way in the validator typings
import { isUUID } from 'validator';
import { getTestDialect, sequelize } from '../../../support';

const dialect = getTestDialect();

describe('QueryGenerator#generateTransactionId', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('generates a transaction id', async () => {
    const id = queryGenerator.generateTransactionId();

    if (dialect === 'mssql' || dialect === 'db2') {
      expect(id).to.have.lengthOf(20);
    } else {
      expect(isUUID(id, 4)).to.be.true;
    }
  });
});
