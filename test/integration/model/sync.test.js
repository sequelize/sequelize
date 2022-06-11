'use strict';

const { expect } = require('chai');
const { DataTypes } = require('@sequelize/core');
const { sequelize, getTestDialect, getTestDialectTeaser } = require('../support');

const dialect = getTestDialect();

describe(getTestDialectTeaser('Model.sync & Sequelize.sync'), () => {
  it('removes a column if it exists in the databases schema but not the model', async () => {
    const User = sequelize.define('testSync', {
      name: DataTypes.STRING,
      age: DataTypes.INTEGER,
      badgeNumber: { type: DataTypes.INTEGER, field: 'badge_number' },
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
      height: { type: DataTypes.INTEGER, field: 'height_cm' },
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
      badgeNumber: { type: DataTypes.INTEGER, field: 'badge_number' },
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
      expect(data.age.type).to.have.string('VAR'); // CHARACTER VARYING, VARCHAR(n)
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
    expect(data.dataValues.name).to.eql('test');
    expect(data.dataValues.age).to.eql('1');
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

    await User.sync({ alter: true });

    const alterResults = await getNonPrimaryIndexes(User);
    expect(syncResults).to.deep.eq(alterResults, '"alter" should not create new indexes if they already exist.');
  });

  it('creates one unique index per unique:true columns, and per entry in options.indexes', async () => {
    const User = sequelize.define('testSync', {
      email: {
        type: DataTypes.STRING,
        unique: true,
      },
      phone: {
        type: DataTypes.STRING,
        unique: true,
      },
    }, {
      timestamps: false,
      indexes: [
        { name: 'wow_my_index', fields: ['email', 'phone'], unique: true },
      ],
    });

    await User.sync({ force: true });

    const syncResults = await getNonPrimaryIndexes(User);

    syncResults.sort((a, b) => a.name.localeCompare(b.name));

    expect(syncResults).to.have.length(3);
    expect(syncResults[0].name).to.eq('test_syncs_email_unique');
    expect(syncResults[0].fields.map(f => f.attribute)).to.deep.eq(['email']);

    expect(syncResults[1].name).to.eq('test_syncs_phone_unique');
    expect(syncResults[1].fields.map(f => f.attribute)).to.deep.eq(['phone']);

    expect(syncResults[2].name).to.eq('wow_my_index');
    expect(syncResults[2].fields.map(f => f.attribute).sort()).to.deep.eq(['email', 'phone']);

    expect(syncResults.filter(r => r.name === 'wow_my_index')).to.have.length(1);

    await User.sync({ alter: true });

    const alterResults = await getNonPrimaryIndexes(User);
    expect(syncResults).to.deep.eq(alterResults, '"alter" should not create new indexes if they already exist.');
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
    expect(syncResults[0].fields.map(field => field.attribute).sort()).to.deep.eq(['email']);

    await User.sync({ alter: true });

    const alterResults = await getNonPrimaryIndexes(User);
    expect(syncResults).to.deep.eq(alterResults, '"alter" should not create new indexes if they already exist.');
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
    expect(syncResults[0].fields.map(field => field.attribute).sort()).to.deep.eq(['email', 'phone']);

    await User.sync({ alter: true });

    const alterResults = await getNonPrimaryIndexes(User);
    expect(syncResults).to.deep.eq(alterResults, '"alter" should not create new indexes if they already exist.');
  });

  it('throws if a name collision occurs between two indexes', async () => {
    expect(() => {
      sequelize.define('testSync', {
        email: {
          type: DataTypes.STRING,
          unique: true,
        },
      }, {
        timestamps: false,
        indexes: [
          { fields: ['email'], unique: true },
        ],
      });
    }).to.throw('Sequelize tried to give the name "test_syncs_email_unique" to index');
  });

  it('adds missing unique indexes to existing tables (unique attribute option)', async () => {
    const User1 = sequelize.define('User', {
      email: {
        type: DataTypes.STRING,
      },
    }, { timestamps: false });

    // create without the unique index
    await User1.sync({ force: true });

    // replace model (to emulate code changes)
    const User2 = sequelize.define('User', {
      email: {
        type: DataTypes.STRING,
        unique: true,
      },
    }, { timestamps: false });

    const out1 = await getNonPrimaryIndexes(User1);
    expect(out1).to.have.length(0);

    // alter to add the unique index
    await User2.sync({ alter: true });

    const out2 = await getNonPrimaryIndexes(User1);
    expect(out2).to.have.length(1);

    const uniques = out2.filter(index => index.primary !== true);
    expect(uniques).to.have.length(1);
    expect(uniques[0].unique).to.eq(true, 'index should be unique');
  });

  it('should be able to add a unique index to an existing table (index option)', async () => {
    const User1 = sequelize.define('User', {
      email: {
        type: DataTypes.STRING,
      },
    }, { timestamps: false });

    // create without the unique index
    await User1.sync({ force: true });

    // replace model (to emulate code changes)
    const User2 = sequelize.define('User', {
      email: {
        type: DataTypes.STRING,
      },
    }, {
      timestamps: false,
      indexes: [
        { fields: ['email'], unique: true },
      ],
    });

    const out1 = await getNonPrimaryIndexes(User1);
    expect(out1).to.have.length(0);

    // alter to add the unique index
    await User2.sync({ alter: true });

    const out2 = await getNonPrimaryIndexes(User1);
    expect(out2).to.have.length(1);
    const uniques = out2.filter(index => index.primary !== true);
    expect(uniques).to.have.length(1);
    expect(uniques[0].unique).to.be.true;
  });

  it('should be able to add a non-unique index to an existing table', async () => {
    const User1 = sequelize.define('User', {
      email: {
        type: DataTypes.STRING,
      },
    }, { timestamps: false });

    // create without the unique index
    await User1.sync({ force: true });

    // replace model (to emulate code changes)
    const User2 = sequelize.define('User', {
      email: {
        type: DataTypes.STRING,
      },
    }, {
      timestamps: false,
      indexes: [
        { fields: ['email'] },
      ],
    });

    const out1 = await getNonPrimaryIndexes(User1);
    expect(out1).to.have.length(0);

    // alter to add the unique index
    await User2.sync({ alter: true });

    const out2 = await getNonPrimaryIndexes(User1);
    expect(out2).to.have.length(1);
    const nonUniques = out2.filter(index => index.primary !== true);
    expect(nonUniques).to.have.length(1);
    expect(nonUniques[0].unique).to.be.false;
  });
});

async function getNonPrimaryIndexes(model) {
  return (await sequelize.getQueryInterface().showIndex(model.getTableName()))
    .filter(r => !r.primary)
    .sort((a, b) => a.name.localeCompare(b.name));
}
