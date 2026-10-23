import type { ModelStatic, Sequelize } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { createSequelizeInstance, sequelize } from '../../support';

describe('Model options.omitNull', () => {
  afterEach(() => {
    sinon.restore();
  });

  function defineUser(sequelizeInstance: Sequelize, omitNull?: boolean): ModelStatic {
    return sequelizeInstance.define(
      'User',
      {
        name: DataTypes.STRING,
        nullableColumn: DataTypes.STRING,
      },
      omitNull === undefined ? {} : { omitNull },
    );
  }

  // Captures the queries instead of running them
  function stubQueries(sequelizeInstance: Sequelize, User: ModelStatic): string[] {
    const queries: string[] = [];
    sinon.stub(sequelizeInstance, 'queryRaw').callsFake(async (sql, options) => {
      queries.push(sql);

      // The typings of queryRaw don't cover the instance being returned when "instance" is set
      return [options?.instance ?? User.build(), 1] as any;
    });

    return queries;
  }

  // Returns the columns written by the only INSERT or UPDATE query, ignoring RETURNING / OUTPUT clauses
  function getWrittenColumns(queries: string[]): string {
    const writeQueries = queries.filter(query => /\b(INSERT INTO|UPDATE)\b/.test(query));
    expect(writeQueries).to.have.length(1);

    const match =
      /INSERT INTO \S+ \(([^)]*)\)/.exec(writeQueries[0]) ??
      /UPDATE \S+ SET (.+?) (?:OUTPUT|WHERE)\b/.exec(writeQueries[0]);
    expect(match, `unexpected query: ${writeQueries[0]}`).to.exist;

    return match?.[1] ?? '';
  }

  it('omits null values when creating a record', async () => {
    const User = defineUser(sequelize, true);
    const queries = stubQueries(sequelize, User);

    await User.create({ name: 'John', nullableColumn: null });

    const columns = getWrittenColumns(queries);
    expect(columns).to.include('name');
    expect(columns).not.to.include('nullableColumn');
  });

  it('omits null values when saving changes to a record', async () => {
    const User = defineUser(sequelize, true);
    const queries = stubQueries(sequelize, User);

    const user = User.build(
      { id: 1, name: 'John', nullableColumn: 'value' },
      { isNewRecord: false },
    );
    user.set({ name: 'Jane', nullableColumn: null });
    await user.save();

    const columns = getWrittenColumns(queries);
    expect(columns).to.include('name');
    expect(columns).not.to.include('nullableColumn');
  });

  it('omits null values in Model.update', async () => {
    const User = defineUser(sequelize, true);
    const queries = stubQueries(sequelize, User);

    await User.update({ name: 'Jane', nullableColumn: null }, { where: { id: 1 } });

    const columns = getWrittenColumns(queries);
    expect(columns).to.include('name');
    expect(columns).not.to.include('nullableColumn');
  });

  it('is overridden by the omitNull option of the call', async () => {
    const User = defineUser(sequelize, true);
    const queries = stubQueries(sequelize, User);

    await User.create({ name: 'John', nullableColumn: null }, { omitNull: false });

    expect(getWrittenColumns(queries)).to.include('nullableColumn');
  });

  it('overrides the omitNull option of the Sequelize instance', async () => {
    const omitNullSequelize = createSequelizeInstance({ omitNull: true });
    const User = defineUser(omitNullSequelize, false);
    const queries = stubQueries(omitNullSequelize, User);

    await User.create({ name: 'John', nullableColumn: null });

    expect(getWrittenColumns(queries)).to.include('nullableColumn');
  });

  it('defaults to the omitNull option of the Sequelize instance', async () => {
    const omitNullSequelize = createSequelizeInstance({ omitNull: true });
    const User = defineUser(omitNullSequelize);
    const queries = stubQueries(omitNullSequelize, User);

    await User.create({ name: 'John', nullableColumn: null });

    expect(getWrittenColumns(queries)).not.to.include('nullableColumn');
  });
});
