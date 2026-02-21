import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../support';

describe('Sequelize#union', () => {
  const vars = {
    User: null as any,
    Guest: null as any,
  };

  beforeEach(async () => {
    vars.User = sequelize.define(
      'User',
      {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
      },
      { timestamps: false },
    );

    vars.Guest = sequelize.define(
      'Guest',
      {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
      },
      { timestamps: false },
    );

    await sequelize.sync({ force: true });
  });

  afterEach(async () => {
    await sequelize.drop();
  });

  it('unions records from two models', async () => {
    await vars.User.create({ name: 'Alice', age: 20 });
    await vars.Guest.create({ name: 'Bob', age: 30 });

    const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }]);

    expect(results).to.have.lengthOf(2);
    const names = results.map((r: any) => r.name as string).sort((a, b) => a.localeCompare(b));
    expect(names).to.deep.equal(['Alice', 'Bob']);
  });

  it('supports UNION ALL (does not Deduplicate)', async () => {
    await vars.User.create({ name: 'Alice', age: 20 });
    await vars.Guest.create({ name: 'Alice', age: 20 });

    const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }], {
      unionAll: true,
    });

    expect(results).to.have.lengthOf(2);
  });

  it('supports UNION (deduplicates by default)', async () => {
    await vars.User.create({ name: 'Alice', age: 20 });
    await vars.Guest.create({ name: 'Alice', age: 20 });

    const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }]);

    expect(results).to.have.lengthOf(1);
    expect(results[0].name).to.equal('Alice');
  });

  it('supports ORDER BY, LIMIT and OFFSET on the union result', async () => {
    await vars.User.bulkCreate([
      { name: 'Alice', age: 20 },
      { name: 'Charlie', age: 40 },
    ]);
    await vars.Guest.bulkCreate([
      { name: 'Bob', age: 30 },
      { name: 'David', age: 50 },
    ]);

    // Union of 4 records.
    // Order by name ASC: Alice, Bob, Charlie, David
    // Limit 2: Alice, Bob
    // Offset 1: Bob -> Expect Bob and Charlie?
    // Limit 2 offset 1 applied to [Alice, Bob, Charlie, David] is [Bob, Charlie]

    const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }], {
      order: ['name'],
      limit: 2,
      offset: 1,
    });

    expect(results).to.have.lengthOf(2);
    expect(results[0].name).to.equal('Bob');
    expect(results[1].name).to.equal('Charlie');
  });

  it('allows specifying attributes in query options', async () => {
    await vars.User.create({ name: 'Alice', age: 20 });
    await vars.Guest.create({ name: 'Bob', age: 30 });

    // Only select name
    const results = await sequelize.union([
      { model: vars.User, options: { attributes: ['name'] } },
      { model: vars.Guest, options: { attributes: ['name'] } },
    ]);

    expect(results).to.have.lengthOf(2);
    expect(results[0]).to.have.property('name');
    expect(results[0]).to.not.have.property('age');
    expect(results[0]).to.have.property('id');
  });
});
