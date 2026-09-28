import type { IBMiConnection } from '@sequelize/db2-ibmi';
import { expect } from 'chai';
import { getTestDialect, sequelize } from '../../../support';

const dialect = getTestDialect();

describe('[IBMi Specific] Connection Manager', () => {
  if (dialect !== 'ibmi') {
    return;
  }

  describe('validate', () => {
    // odbc's Connection exposes `connected` as a getter, even though its typings declare a method.
    function createConnection(connected: boolean): IBMiConnection {
      return {
        get connected() {
          return connected;
        },
      } as unknown as IBMiConnection;
    }

    it('returns true for an open connection', () => {
      expect(sequelize.dialect.connectionManager.validate(createConnection(true))).to.equal(true);
    });

    it('returns false for a closed connection', () => {
      expect(sequelize.dialect.connectionManager.validate(createConnection(false))).to.equal(false);
    });
  });
});
