'use strict';

const { expect } = require('chai');
const { DataTypes, Deferrable, Model } = require('@sequelize/core');
const { getTestDialect, getTestDialectTeaser, sequelize } = require('../support');

const dialect = getTestDialect();

describe(getTestDialectTeaser('Model.sync & Sequelize#sync'), () => {
  it('removes a column if it exists in the databases schema but not the model', async () => {
    const User = sequelize.define('testSync', {
      name: DataTypes.STRING,
      age: DataTypes.INTEGER,
      badgeNumber: { type: DataTypes.INTEGER, columnName: 'badge_number' },
    });

    await sequelize.sync();

    const descr1 = await User.describe();
    expect(descr1).to.have.ownProperty('name');
    expect(descr1).to.have.ownProperty('age');
    expect(descr1).to.have.ownProperty('badge_number');

    sequelize.define('testSync', {
      name: DataTypes.STRING,
    });

    await sequelize.sync({ alter: true });

    const descr2 = await User.describe();
    expect(descr2).to.have.ownProperty('name');
    expect(descr2).to.not.have.ownProperty('age');
    expect(descr2).to.not.have.ownProperty('badge_number');
  });

  it('adds a column if it exists in the model but not the database', async () => {
    const testSync = sequelize.define('testSync', {
      name: DataTypes.STRING,
    });

    await sequelize.sync();

    const descr1 = await testSync.describe();
    expect(descr1).to.have.ownProperty('name');

    await sequelize.define('testSync', {
      name: DataTypes.STRING,
      age: DataTypes.INTEGER,
      height: { type: DataTypes.INTEGER, columnName: 'height_cm' },
    });

    await sequelize.sync({ alter: true });
    const descr2 = await testSync.describe();
    expect(descr2).to.have.ownProperty('name');
    expect(descr2).to.have.ownProperty('age');
    expect(descr2).to.have.ownProperty('height_cm');
    expect(descr2).not.to.have.ownProperty('height');
  });

  it('does not remove columns if drop is set to false in alter configuration', async () => {
    const testSync = sequelize.define('testSync', {
      name: DataTypes.STRING,
      age: DataTypes.INTEGER,
    });
    await sequelize.sync();

    await sequelize.define('testSync', {
      name: DataTypes.STRING,
    });

    await sequelize.sync({ alter: { drop: false } });
    const data = await testSync.describe();
    expect(data).to.have.ownProperty('name');
    expect(data).to.have.ownProperty('age');
  });

  it('removes columns if drop is set to true in alter configuration', async () => {
    const testSync = sequelize.define('testSync', {
      name: DataTypes.STRING,
      age: DataTypes.INTEGER,
    });
    await sequelize.sync();

    await sequelize.define('testSync', {
      name: DataTypes.STRING,
    });

    await sequelize.sync({ alter: { drop: true } });
    const data = await testSync.describe();
    expect(data).to.have.ownProperty('name');
    expect(data).not.to.have.ownProperty('age');
  });

  it('alters a column using the correct column name (#9515)', async () => {
    const testSync = sequelize.define('testSync', {
      name: DataTypes.STRING,
    });

    await sequelize.sync();

    await sequelize.define('testSync', {
      name: DataTypes.STRING,
      badgeNumber: { type: DataTypes.INTEGER, columnName: 'badge_number' },
    });

    await sequelize.sync({ alter: true });
    const data = await testSync.describe();
    expect(data).to.have.ownProperty('badge_number');
    expect(data).not.to.have.ownProperty('badgeNumber');
  });

  // IBM i can't alter INTEGER -> STRING
  if (dialect !== 'ibmi') {
    it('changes a column if it exists in the model but is different in the database', async () => {
      const testSync = sequelize.define('testSync', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
      });
      await sequelize.sync();

      await sequelize.define('testSync', {
        name: DataTypes.STRING,
        age: DataTypes.STRING,
      });

      await sequelize.sync({ alter: true });
      const data = await testSync.describe();
      expect(data).to.have.ownProperty('age');
      if (dialect === 'sqlite3') {
        // sqlite3 does not have a text type with a configurable max width. It uses TEXT which is unlimited.
        expect(data.age.type).to.have.string('TEXT');
      } else {
        expect(data.age.type).to.have.string('VAR'); // CHARACTER VARYING, VARCHAR(n)
      }
    });
  }

  it('does not alter table if data type does not change', async () => {
    const testSync = sequelize.define('testSync', {
      name: DataTypes.STRING,
      age: DataTypes.STRING,
    });
    await sequelize.sync();
    await testSync.create({ name: 'test', age: '1' });
    await sequelize.sync({ alter: true });
    const data = await testSync.findOne();
    expect(data.name).to.eql('test');
    expect(data.age).to.eql('1');
  });

  it('should properly alter tables when there are foreign keys', async () => {
    const foreignKeyTestSyncA = sequelize.define('foreignKeyTestSyncA', {
      dummy: DataTypes.STRING,
    });

    const foreignKeyTestSyncB = sequelize.define('foreignKeyTestSyncB', {
      dummy: DataTypes.STRING,
    });

    foreignKeyTestSyncA.hasMany(foreignKeyTestSyncB);
    foreignKeyTestSyncB.belongsTo(foreignKeyTestSyncA);

    await sequelize.sync({ alter: true });
    await sequelize.sync({ alter: true });
  });

  it('creates one unique index for unique:true column', async () => {
    const User = sequelize.define('testSync', {
      email: {
        type: DataTypes.STRING,
        unique: true,
      },
    });

    await User.sync({ force: true });

    const syncResults = await getNonPrimaryIndexes(User);
    expect(syncResults).to.have.length(1);
    expect(syncResults[0].name).to.eq('test_syncs_email_unique');
    expect(getIndexFields(syncResults[0])).to.deep.eq(['email']);

    await User.sync({ alter: true });

    const alterResults = await getNonPrimaryIndexes(User);
    expect(alterResults).to.deep.eq(
      syncResults,
      '"alter" should not create new indexes if they already exist.',
    );
  });

  it('creates one unique index per unique:true columns, and per entry in options.indexes', async () => {
    const User = sequelize.define(
      'testSync',
      {
        email: {
          type: DataTypes.STRING,
          unique: true,
        },
        phone: {
          type: DataTypes.STRING,
          unique: true,
        },
      },
      {
        timestamps: false,
        indexes: [{ name: 'wow_my_index', fields: ['email', 'phone'], unique: true }],
      },
    );

    await User.sync({ force: true });

    const syncResults = await getNonPrimaryIndexes(User);
    syncResults.sort((a, b) => a.name.localeCompare(b.name));

    expect(syncResults).to.have.length(3);
    expect(syncResults[0].name).to.eq('test_syncs_email_unique');
    expect(getIndexFields(syncResults[0])).to.deep.eq(['email']);
    expect(syncResults[0].unique).to.eq(true, 'index should be unique');

    expect(syncResults[1].name).to.eq('test_syncs_phone_unique');
    expect(getIndexFields(syncResults[1])).to.deep.eq(['phone']);
    expect(syncResults[1].unique).to.eq(true, 'index should be unique');

    expect(syncResults[2].name).to.eq('wow_my_index');
    expect(getIndexFields(syncResults[2])).to.deep.eq(['email', 'phone']);
    expect(syncResults[2].unique).to.eq(true, 'index should be unique');

    await User.sync({ alter: true });

    const alterResults = await getNonPrimaryIndexes(User);
    expect(syncResults).to.deep.eq(
      alterResults,
      '"alter" should not create new indexes if they already exist.',
    );
  });

  it('creates one unique index per unique:name column (1 column)', async () => {
    const User = sequelize.define('testSync', {
      email: {
        type: DataTypes.STRING,
        unique: 'wow_my_index',
      },
    });

    await User.sync({ force: true });

    const syncResults = await getNonPrimaryIndexes(User);

    expect(syncResults).to.have.length(1);
    expect(syncResults[0].name).to.eq('wow_my_index');
    expect(getIndexFields(syncResults[0])).to.deep.eq(['email']);
    expect(syncResults[0].unique).to.eq(true, 'index should be unique');

    await User.sync({ alter: true });

    const alterResults = await getNonPrimaryIndexes(User);
    expect(syncResults).to.deep.eq(
      alterResults,
      '"alter" should not create new indexes if they already exist.',
    );
  });

  it('creates one unique index per unique:name column (multiple columns)', async () => {
    const User = sequelize.define('testSync', {
      email: {
        type: DataTypes.STRING,
        unique: 'wow_my_index',
      },
      phone: {
        type: DataTypes.STRING,
        unique: 'wow_my_index',
      },
    });

    await User.sync({ force: true });

    const syncResults = await getNonPrimaryIndexes(User);

    expect(syncResults).to.have.length(1);
    expect(syncResults[0].name).to.eq('wow_my_index');
    expect(getIndexFields(syncResults[0])).to.deep.eq(['email', 'phone']);
    expect(syncResults[0].unique).to.eq(true, 'index should be unique');

    await User.sync({ alter: true });

    const alterResults = await getNonPrimaryIndexes(User);
    expect(syncResults).to.deep.eq(
      alterResults,
      '"alter" should not create new indexes if they already exist.',
    );
  });

  it('throws if a name collision occurs between two indexes', async () => {
    expect(() => {
      sequelize.define(
        'testSync',
        {
          email: {
            type: DataTypes.STRING,
            unique: true,
          },
        },
        {
          timestamps: false,
          indexes: [{ fields: ['email'], unique: true }],
        },
      );
    }).to.throwWithCause('Sequelize tried to give the name "test_syncs_email_unique" to index');
  });

  it('adds missing unique indexes to existing tables (unique attribute option)', async () => {
    const User1 = sequelize.define(
      'User',
      {
        email: {
          type: DataTypes.STRING,
        },
      },
      { timestamps: false },
    );

    // create without the unique index
    await User1.sync({ force: true });

    // replace model (to emulate code changes)
    const User2 = sequelize.define(
      'User',
      {
        email: {
          type: DataTypes.STRING,
          unique: true,
        },
      },
      { timestamps: false },
    );

    const out1 = await getNonPrimaryIndexes(User1);
    expect(out1).to.have.length(0);

    // alter to add the unique index
    await User2.sync({ alter: true });

    const out2 = await getNonPrimaryIndexes(User1);

    expect(out2).to.have.length(1);
    expect(out2[0].name).to.eq('users_email_unique');
    expect(getIndexFields(out2[0])).to.deep.eq(['email']);
    expect(out2[0].unique).to.eq(true, 'index should be unique');
  });

  it('adds missing unique indexes to existing tables (index option)', async () => {
    const User1 = sequelize.define(
      'User',
      {
        email: {
          type: DataTypes.STRING,
        },
      },
      { timestamps: false },
    );

    // create without the unique index
    await User1.sync({ force: true });

    // replace model (to emulate code changes)
    const User2 = sequelize.define(
      'User',
      {
        email: {
          type: DataTypes.STRING,
        },
      },
      {
        timestamps: false,
        indexes: [{ fields: ['email'], unique: true }],
      },
    );

    const out1 = await getNonPrimaryIndexes(User1);
    expect(out1).to.have.length(0);

    // alter to add the unique index
    await User2.sync({ alter: true });

    const out2 = await getNonPrimaryIndexes(User1);
    expect(out2).to.have.length(1);
    expect(out2[0].name).to.eq('users_email_unique');
    expect(getIndexFields(out2[0])).to.deep.eq(['email']);
    expect(out2[0].unique).to.eq(true, 'index should be unique');
  });

  it('adds missing non-unique indexes to existing tables (index option)', async () => {
    const User1 = sequelize.define(
      'User',
      {
        email: {
          type: DataTypes.STRING,
        },
      },
      { timestamps: false },
    );

    // create without the unique index
    await User1.sync({ force: true });

    // replace model (to emulate code changes)
    const User2 = sequelize.define(
      'User',
      {
        email: {
          type: DataTypes.STRING,
        },
      },
      {
        timestamps: false,
        indexes: [{ fields: ['email'] }],
      },
    );

    const out1 = await getNonPrimaryIndexes(User1);
    expect(out1).to.have.length(0);

    // alter to add the unique index
    await User2.sync({ alter: true });

    const out2 = await getNonPrimaryIndexes(User1);
    expect(out2).to.have.length(1);
    expect(out2[0].name).to.eq('users_email');
    expect(getIndexFields(out2[0])).to.deep.eq(['email']);
    expect(out2[0].unique).to.eq(false, 'index should not be unique');
  });

  it('adds missing unique columns to existing tables', async () => {
    const User1 = sequelize.define('User', {}, { timestamps: false });

    // create without the unique index
    await User1.sync({ force: true });
    await User1.create({ id: 1 });

    const out1 = await getNonPrimaryIndexes(User1);
    expect(out1).to.have.length(0);

    // replace model (to emulate code changes)
    const User2 = sequelize.define(
      'User',
      {
        email: {
          type: DataTypes.STRING,
          unique: true,
        },
      },
      {
        timestamps: false,
      },
    );

    // alter to add the unique index
    await User2.sync({ alter: true });

    // db2 had a bug which re-created the table in some circumstances.
    // this ensures the table is not recreated, but altered.
    const existingData = await User2.findAll();
    expect(existingData).to.have.length(1);

    const out2 = await getNonPrimaryIndexes(User1);
    expect(out2).to.have.length(1);
    expect(out2[0].name).to.eq('users_email_unique');
    expect(getIndexFields(out2[0])).to.deep.eq(['email']);
    expect(out2[0].unique).to.eq(true, 'index should not be unique');
  });

  const SCHEMA_ONE = 'schema_one';
  const SCHEMA_TWO = 'schema_two';

  if (sequelize.dialect.supports.schemas) {
    it('can create two identically named indexes in different schemas', async () => {
      await Promise.all([sequelize.createSchema(SCHEMA_ONE), sequelize.createSchema(SCHEMA_TWO)]);

      const User = sequelize.define(
        'User1',
        {
          name: DataTypes.STRING,
        },
        {
          schema: SCHEMA_ONE,
          indexes: [
            {
              name: 'test_slug_idx',
              fields: ['name'],
            },
          ],
        },
      );

      const Task = sequelize.define(
        'Task2',
        {
          name: DataTypes.STRING,
        },
        {
          schema: SCHEMA_TWO,
          indexes: [
            {
              name: 'test_slug_idx',
              fields: ['name'],
            },
          ],
        },
      );

      await User.sync({ force: true });
      await Task.sync({ force: true });

      const [userIndexes, taskIndexes] = await Promise.all([
        getNonPrimaryIndexes(User),
        getNonPrimaryIndexes(Task),
      ]);

      expect(userIndexes).to.have.length(1);
      expect(taskIndexes).to.have.length(1);

      expect(userIndexes[0].name).to.eq('test_slug_idx');
      expect(taskIndexes[0].name).to.eq('test_slug_idx');
    });

    it('supports creating two identically named tables in different schemas', async () => {
      await sequelize.queryInterface.createSchema('custom_schema');

      const Model1 = sequelize.define(
        'A1',
        {},
        { schema: 'custom_schema', tableName: 'a', timestamps: false },
      );
      const Model2 = sequelize.define('A2', {}, { tableName: 'a', timestamps: false });

      await sequelize.sync({ force: true });

      await Model1.create({ id: 1 });
      await Model2.create({ id: 2 });
    });
  }

  it('defaults to schema provided to sync() for references #11276', async function () {
    // TODO: this should work with MSSQL / MariaDB too
    if (!dialect !== 'postgres') {
      return;
    }

    await Promise.all([sequelize.createSchema(SCHEMA_ONE), sequelize.createSchema(SCHEMA_TWO)]);

    const User = this.sequelize.define('UserXYZ', {
      uid: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
    });
    const Task = this.sequelize.define('TaskXYZ', {});

    Task.belongsTo(User);

    // TODO: do we really want to keep this? Shouldn't model schemas be defined and fixed?
    await User.sync({ force: true, schema: SCHEMA_ONE });
    await Task.sync({ force: true, schema: SCHEMA_ONE });
    const user0 = await User.withSchema(SCHEMA_ONE).create({});
    const task = await Task.withSchema(SCHEMA_ONE).create({});
    await task.setUserXYZ(user0);

    // TODO: do we really want to keep this? Shouldn't model schemas be defined and fixed?
    const user = await task.getUserXYZ({ schema: SCHEMA_ONE });
    expect(user).to.be.ok;
  });

  it('supports creating tables with cyclic associations', async () => {
    const A = sequelize.define('A', {}, { timestamps: false });
    const B = sequelize.define('B', {}, { timestamps: false });

    // mssql refuses cyclic references unless ON DELETE and ON UPDATE is set to NO ACTION
    const mssqlConstraints =
      dialect === 'mssql' ? { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' } : null;

    // These models both have a foreign key that references the other model.
    // Sequelize should be able to create them.
    A.belongsTo(B, { foreignKey: { allowNull: false, ...mssqlConstraints } });
    B.belongsTo(A, { foreignKey: { allowNull: false, ...mssqlConstraints } });

    await sequelize.sync();

    const [aFks, bFks] = await Promise.all([
      sequelize.queryInterface.showConstraints(A, { constraintType: 'FOREIGN KEY' }),
      sequelize.queryInterface.showConstraints(B, { constraintType: 'FOREIGN KEY' }),
    ]);

    expect(aFks.length).to.eq(1);
    expect(aFks[0].referencedTableName).to.eq('Bs');
    expect(aFks[0].referencedColumnNames).to.deep.eq(['id']);
    expect(aFks[0].columnNames).to.deep.eq(['bId']);

    expect(bFks.length).to.eq(1);
    expect(bFks[0].referencedTableName).to.eq('As');
    expect(bFks[0].referencedColumnNames).to.deep.eq(['id']);
    expect(bFks[0].columnNames).to.deep.eq(['aId']);
  });

  // TODO: sqlite3's foreign_key_list pragma does not return the DEFERRABLE status of the column
  //  so sync({ alter: true }) cannot know whether the column must be updated.
  //  so for now, deferrable constraints is disabled for sqlite3 (as it's only used in tests)
  if (sequelize.dialect.supports.constraints.deferrable) {
    it('updates the deferrable property of a foreign key', async () => {
      const A = sequelize.define('A', {
        BId: {
          type: DataTypes.INTEGER,
          references: {
            deferrable: Deferrable.INITIALLY_IMMEDIATE,
          },
        },
      });
      const B = sequelize.define('B');

      A.belongsTo(B);

      await sequelize.sync();

      const aFks = await sequelize.queryInterface.showConstraints(A, {
        constraintType: 'FOREIGN KEY',
      });

      expect(aFks).to.have.length(1);
      expect(aFks[0].deferrable).to.eq(Deferrable.INITIALLY_IMMEDIATE);

      A.modelDefinition.rawAttributes.bId.references.deferrable = Deferrable.INITIALLY_DEFERRED;
      A.modelDefinition.refreshAttributes();
      await sequelize.sync({ alter: true });

      const aFks2 = await sequelize.queryInterface.showConstraints(A, {
        constraintType: 'FOREIGN KEY',
      });

      expect(aFks2).to.have.length(1);
      expect(aFks2[0].deferrable).to.eq(Deferrable.INITIALLY_DEFERRED);
    });
  }

  if (sequelize.dialect.supports.schemas) {
    it('should not recreate a foreign key if it already exists when { alter: true } is used with a custom schema', async () => {
      const schema = 'test';
      await sequelize.createSchema(schema);

      const User = sequelize.define('User', {}, { schema });
      const BelongsToUser = sequelize.define('BelongsToUser', {}, { schema });
      BelongsToUser.belongsTo(User, { foreignKey: { targetKey: 'id', allowNull: false } });
      await sequelize.sync({ alter: true });
      await sequelize.sync({ alter: true });

      const results = await sequelize.queryInterface.showConstraints(BelongsToUser, {
        constraintType: 'FOREIGN KEY',
      });
      expect(results).to.have.length(1);
    });

    it('should not recreate a foreign key if it already exists when { alter: true } is used with a custom schema (reference attribute is a Model)', async () => {
      const schema = 'test';
      await sequelize.createSchema(schema);

      class User extends Model {}

      class BelongsToUser extends Model {}

      User.init({}, { sequelize, schema });
      BelongsToUser.init(
        {
          user_id: {
            type: DataTypes.INTEGER,
            references: {
              model: User,
              key: 'id',
            },
          },
        },
        { sequelize, schema },
      );
      await sequelize.sync({ alter: true });
      await sequelize.sync({ alter: true });
      const results = await sequelize.queryInterface.showConstraints(BelongsToUser, {
        constraintType: 'FOREIGN KEY',
      });
      expect(results).to.have.length(1);
    });
  }

  // TODO add support for db2 and mssql dialects
  if (dialect !== 'db2' && dialect !== 'mssql') {
    it('does not recreate existing enums (#7649)', async () => {
      sequelize.define('Media', {
        type: DataTypes.ENUM(['video', 'audio']),
      });
      await sequelize.sync({ alter: true });
      sequelize.define('Media', {
        type: DataTypes.ENUM(['image', 'video', 'audio']),
      });
      await sequelize.sync({ alter: true });
    });
  }
});

async function getNonPrimaryIndexes(model) {
  return (await sequelize.queryInterface.showIndex(model.table))
    .filter(r => !r.primary)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getIndexFields(index) {
  return index.fields.map(field => field.attribute).sort();
}
