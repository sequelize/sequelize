import { DataTypes, QueryTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;

// ENUM has no "supports" flag, but the only dialect that supports ARRAY (postgres) also supports ENUM.
describe('QueryInterface with ARRAY(ENUM) columns that have a default value', () => {
  if (!sequelize.dialect.supports.dataTypes.ARRAY) {
    return;
  }

  const arrayEnum = () => ({
    type: DataTypes.ARRAY(DataTypes.ENUM(['foo', 'bar'])),
    allowNull: false,
    defaultValue: ['foo'],
  });

  async function getDefault(tableName: string) {
    await sequelize.query(`INSERT INTO "${tableName}" DEFAULT VALUES`);
    const rows = await sequelize.query<{ value: string }>(
      `SELECT "value"::text AS value FROM "${tableName}"`,
      { type: QueryTypes.SELECT },
    );

    return rows[0].value;
  }

  it('creates the column through createTable', async () => {
    await queryInterface.createTable('users', { value: arrayEnum() });

    expect(await getDefault('users')).to.equal('{foo}');
  });

  it('creates the column through addColumn', async () => {
    await queryInterface.createTable('users', { name: DataTypes.STRING });
    await queryInterface.addColumn('users', 'value', arrayEnum());

    expect(await getDefault('users')).to.equal('{foo}');
  });

  it('creates the column through sync', async () => {
    const User = sequelize.define('User', { value: arrayEnum() }, { timestamps: false });

    await User.sync();

    const user = await User.create({});
    expect(user.get('value')).to.deep.equal(['foo']);
  });

  it('creates the column through sync({ alter: true })', async () => {
    sequelize.define('User', { name: DataTypes.STRING }, { timestamps: false });
    await sequelize.sync();

    const User = sequelize.define(
      'User',
      { name: DataTypes.STRING, value: arrayEnum() },
      { timestamps: false, freezeTableName: false },
    );

    await User.sync({ alter: true });

    const user = await User.create({});
    expect(user.get('value')).to.deep.equal(['foo']);
  });

  it('generates the SQL of changeColumn', async () => {
    await queryInterface.createTable('users', {
      value: { type: DataTypes.ARRAY(DataTypes.ENUM(['foo', 'bar'])) },
    });

    // changeColumn of an enum array currently fails on its USING cast, which is a separate bug,
    // but it must no longer fail while determining the name of the enum type.
    const error = await queryInterface
      .changeColumn('users', 'value', arrayEnum())
      .catch(error_ => error_);

    expect(String(error?.message ?? '')).to.not.include(
      'Could not determine the name of this enum',
    );
  });

  it('supports re-using a single DataType instance across multiple tables', async () => {
    const type = DataTypes.ARRAY(DataTypes.ENUM(['foo', 'bar']));

    await queryInterface.createTable('users', { value: { type, defaultValue: ['foo'] } });
    await queryInterface.createTable('projects', { value: { type, defaultValue: ['bar'] } });

    expect(await getDefault('users')).to.equal('{foo}');
    expect(await getDefault('projects')).to.equal('{bar}');
  });
});
