import { DataTypes, Model } from '@sequelize/core';
import { Attribute } from '@sequelize/core/decorators-legacy';
import { SqliteDialect } from '@sequelize/sqlite3';
import { expect } from 'chai';
import { createSequelizeInstance } from './dev/sscce-helpers';

class User extends Model {
  @Attribute({
    type: DataTypes.STRING,
    allowNull: false,
  })
  declare username: string;

  @Attribute({
    type: DataTypes.DATE,
    allowNull: false,
  })
  declare birthday: Date;
}

const sequelize = createSequelizeInstance({
  dialect: SqliteDialect,
  benchmark: true,
  models: [User],
});

(async () => {
  await sequelize.sync({ force: true });

  const jane = await User.create({
    username: 'janedoe',
    birthday: new Date(1980, 6, 20),
  });

  console.log('\nJane:', jane.toJSON());

  await sequelize.close();

  expect(jane.username).to.equal('janedoe');
})();
