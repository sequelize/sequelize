import type { DatabaseDescription } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;
const dialect = sequelize.dialect.name;
const newDbName = 'myDB';

describe('QueryInterface#{create,drop,list}Database', () => {
  if (sequelize.dialect.supports.multiDatabases) {
    it('should create, drop, and list databases respectively', async () => {
      const preCreationDatabases: DatabaseDescription[] = await queryInterface.listDatabases();
      expect(preCreationDatabases.some(db => db.name === newDbName)).to.eq(
        false,
        'Database already exists prior to running the test',
      );

      await queryInterface.createDatabase(newDbName);
      const databases = await queryInterface.listDatabases();

      expect(databases.some(db => db.name === newDbName)).to.eq(
        true,
        'Database "myDB" was not created',
      );
      expect(databases.length).to.eq(preCreationDatabases.length + 1);

      await queryInterface.dropDatabase(newDbName);
      const postDeletionDatabases: DatabaseDescription[] = await queryInterface.listDatabases();

      expect(postDeletionDatabases.some(db => db.name === newDbName)).to.eq(
        false,
        'Database "myDB" still exists, but should have been deleted',
      );
      expect(postDeletionDatabases.length).to.eq(preCreationDatabases.length);
    });

    it('should list all databases except technical ones', async () => {
      const databases: DatabaseDescription[] = await queryInterface.listDatabases();
      expect(databases).to.deep.equal([{ name: 'sequelize_test' }]);
    });
  } else {
    it('should throw, indicating that the method is not supported', async () => {
      await expect(queryInterface.createDatabase(newDbName)).to.be.rejectedWith(
        `Databases are not supported in ${dialect}.`,
      );
      await expect(queryInterface.dropDatabase(newDbName)).to.be.rejectedWith(
        `Databases are not supported in ${dialect}.`,
      );
      await expect(queryInterface.listDatabases()).to.be.rejectedWith(
        `Databases are not supported in ${dialect}.`,
      );
    });
  }
});
