import type { InferAttributes, InferCreationAttributes, Sequelize } from '@sequelize/core';
import { DataTypes, Model, sql } from '@sequelize/core';
import { expect } from 'chai';
import {
  createSingleTransactionalTestSequelizeInstance,
  getTestDialectTeaser,
  sequelize,
} from '../support';

const dialectName = sequelize.dialect.name;

describe(getTestDialectTeaser('Sequelize#union'), () => {
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
    const names = results.map(row => row.name as string).sort((a, b) => a.localeCompare(b));
    expect(names).to.deep.equal(['Alice', 'Bob']);
  });

  it('returns plain objects, not model instances', async () => {
    await vars.User.create({ name: 'Alice', age: 20 });

    const results = await sequelize.union([{ model: vars.User }]);

    expect(results).to.have.lengthOf(1);
    expect(results[0]).to.not.be.instanceOf(Model);
    expect(results[0]).to.not.have.property('toJSON');
  });

  describe('deduplication', () => {
    // Two rows that are identical in *every* selected column, including the primary key. This is
    // what a UNION has to deduplicate; a sparse table where only one column matches would not prove
    // anything, since the primary keys would still differ.
    beforeEach(async () => {
      await vars.User.create({ id: 1, name: 'Alice', age: 20 });
      await vars.Guest.create({ id: 1, name: 'Alice', age: 20 });
    });

    it('removes duplicate rows by default', async () => {
      const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }]);

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({ id: 1, name: 'Alice', age: 20 });
    });

    it('keeps duplicate rows when "unionAll" is true', async () => {
      const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }], {
        unionAll: true,
      });

      expect(results).to.have.lengthOf(2);
    });

    it('does not deduplicate rows that differ in a single column', async () => {
      await vars.Guest.create({ id: 2, name: 'Alice', age: 21 });

      const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }]);

      expect(results).to.have.lengthOf(2);
    });
  });

  describe('ordering and pagination', () => {
    beforeEach(async () => {
      await vars.User.bulkCreate([
        { name: 'Alice', age: 20 },
        { name: 'Charlie', age: 40 },
      ]);
      await vars.Guest.bulkCreate([
        { name: 'Bob', age: 30 },
        { name: 'David', age: 50 },
      ]);
    });

    it('supports ORDER BY, LIMIT and OFFSET on the union result', async () => {
      // Alice, Bob, Charlie, David -> offset 1, limit 2 -> Bob, Charlie
      const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }], {
        order: ['name'],
        limit: 2,
        offset: 1,
      });

      expect(results.map(row => row.name)).to.deep.equal(['Bob', 'Charlie']);
    });

    it('supports an explicit order direction', async () => {
      const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }], {
        order: [['age', 'DESC']],
      });

      expect(results.map(row => row.age)).to.deep.equal([50, 40, 30, 20]);
    });

    it('supports ordering by a literal', async () => {
      const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }], {
        order: [sql.literal(`${sequelize.queryGenerator.quoteIdentifier('age')} DESC`)],
      });

      expect(results.map(row => row.age)).to.deep.equal([50, 40, 30, 20]);
    });

    // MSSQL's `OFFSET ... FETCH NEXT` and Oracle both reject a limited result set that is not
    // ordered, so `union` falls back to ordering by the first result column.
    it('supports LIMIT without an explicit order', async () => {
      const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }], {
        limit: 2,
      });

      expect(results).to.have.lengthOf(2);
    });

    it('supports OFFSET without an explicit order', async () => {
      const results = await sequelize.union([{ model: vars.User }, { model: vars.Guest }], {
        offset: 1,
      });

      expect(results).to.have.lengthOf(3);
    });

    it('throws when ordering by a column the union does not return', async () => {
      const promise = sequelize.union([{ model: vars.User }, { model: vars.Guest }], {
        order: ['nope'],
      });

      await expect(promise).to.be.rejectedWith(
        TypeError,
        'Sequelize#union: cannot order by "nope", because it is not one of the columns returned by the union',
      );
    });

    it('throws when ordering by an attribute that was not selected', async () => {
      const promise = sequelize.union(
        [
          { model: vars.User, options: { attributes: ['name'] } },
          { model: vars.Guest, options: { attributes: ['name'] } },
        ],
        { order: ['age'] },
      );

      await expect(promise).to.be.rejectedWith(TypeError, 'Sequelize#union: cannot order by "age"');
    });

    it('throws on an invalid order direction instead of silently using ASC', async () => {
      const promise = sequelize.union([{ model: vars.User }, { model: vars.Guest }], {
        order: [['name', 'DESCC' as any]],
      });

      await expect(promise).to.be.rejectedWith('Invalid order direction: DESCC');
    });

    it('throws when "order" is not an array', async () => {
      const promise = sequelize.union([{ model: vars.User }, { model: vars.Guest }], {
        order: 'name' as any,
      });

      await expect(promise).to.be.rejectedWith(
        TypeError,
        'Sequelize#union: the "order" option must be an array',
      );
    });
  });

  describe('attributes', () => {
    it('only returns the requested attributes', async () => {
      await vars.User.create({ name: 'Alice', age: 20 });
      await vars.Guest.create({ name: 'Bob', age: 30 });

      const results = await sequelize.union([
        { model: vars.User, options: { attributes: ['name'] } },
        { model: vars.Guest, options: { attributes: ['name'] } },
      ]);

      expect(results).to.have.lengthOf(2);
      for (const row of results) {
        expect(Object.keys(row)).to.deep.equal(['name']);
      }
    });

    it('names the result columns after the aliases of the first query', async () => {
      const Car = sequelize.define(
        'Car',
        { name: DataTypes.STRING, topSpeed: DataTypes.INTEGER },
        { timestamps: false },
      );
      const Plane = sequelize.define(
        'Plane',
        { name: DataTypes.STRING, maxAirSpeed: DataTypes.INTEGER },
        { timestamps: false },
      );

      await sequelize.sync({ force: true });
      await Car.create({ name: 'Sedan', topSpeed: 200 });
      await Plane.create({ name: 'Jet', maxAirSpeed: 900 });

      const results = await sequelize.union(
        [
          { model: Car, options: { attributes: ['name', ['topSpeed', 'velocity']] } },
          { model: Plane, options: { attributes: ['name', ['maxAirSpeed', 'velocity']] } },
        ],
        { order: [['velocity', 'DESC']] },
      );

      expect(results).to.deep.equal([
        { name: 'Jet', velocity: 900 },
        { name: 'Sedan', velocity: 200 },
      ]);
    });

    it('maps attributes whose column name differs from the attribute name', async () => {
      const Employee = sequelize.define(
        'Employee',
        {
          name: { type: DataTypes.STRING, columnName: 'employee_name' },
          age: DataTypes.INTEGER,
        },
        { timestamps: false },
      );
      const Contractor = sequelize.define(
        'Contractor',
        {
          name: { type: DataTypes.STRING, columnName: 'contractor_name' },
          age: DataTypes.INTEGER,
        },
        { timestamps: false },
      );

      await sequelize.sync({ force: true });
      await Employee.create({ name: 'Alice', age: 20 });
      await Contractor.create({ name: 'Bob', age: 30 });

      const results = await sequelize.union([{ model: Employee }, { model: Contractor }], {
        order: ['name'],
      });

      // The result columns are named after the *attributes*, not the underlying columns.
      expect(results.map(row => row.name)).to.deep.equal(['Alice', 'Bob']);
    });
  });

  describe('scopes and paranoid models', () => {
    it('applies the scope of each model', async () => {
      const ScopedUser = sequelize.define(
        'ScopedUser',
        { name: DataTypes.STRING, age: DataTypes.INTEGER },
        { timestamps: false, defaultScope: { where: { age: 20 } } },
      );

      await sequelize.sync({ force: true });
      await ScopedUser.bulkCreate([
        { name: 'Alice', age: 20 },
        { name: 'Bob', age: 30 },
      ]);

      const results = await sequelize.union([{ model: ScopedUser }]);

      expect(results.map(row => row.name)).to.deep.equal(['Alice']);
    });

    it('excludes soft-deleted rows of paranoid models', async () => {
      const Post = sequelize.define(
        'Post',
        { title: DataTypes.STRING },
        { timestamps: true, paranoid: true },
      );
      const Comment = sequelize.define(
        'Comment',
        { title: DataTypes.STRING },
        { timestamps: true, paranoid: true },
      );

      await sequelize.sync({ force: true });
      await Post.create({ title: 'kept' });
      const deletedPost = await Post.create({ title: 'deleted' });
      await deletedPost.destroy();
      await Comment.create({ title: 'comment' });

      const results = await sequelize.union([
        { model: Post, options: { attributes: ['title'] } },
        { model: Comment, options: { attributes: ['title'] } },
      ]);

      expect(
        results.map(row => row.title as string).sort((a, b) => a.localeCompare(b)),
      ).to.deep.equal(['comment', 'kept']);
    });

    it('includes soft-deleted rows when "paranoid" is false', async () => {
      const Post = sequelize.define(
        'Post',
        { title: DataTypes.STRING },
        { timestamps: true, paranoid: true },
      );

      await sequelize.sync({ force: true });
      const deletedPost = await Post.create({ title: 'deleted' });
      await deletedPost.destroy();

      const results = await sequelize.union([
        { model: Post, options: { attributes: ['title'], paranoid: false } },
      ]);

      expect(results.map(row => row.title)).to.deep.equal(['deleted']);
    });
  });

  describe('validation', () => {
    it('throws when no query is provided', async () => {
      await expect(sequelize.union([])).to.be.rejectedWith(
        TypeError,
        'Sequelize#union requires an array of at least one query.',
      );
    });

    it('throws when a query has no model', async () => {
      await expect(sequelize.union([{} as any])).to.be.rejectedWith(
        TypeError,
        'Sequelize#union: query 0 must be an object with a valid "model" property.',
      );
    });

    it('throws when member queries have different column counts', async () => {
      // User returns [id, name, age], Guest returns [id, name]
      const promise = sequelize.union([
        { model: vars.User },
        { model: vars.Guest, options: { attributes: ['id', 'name'] } },
      ]);

      await expect(promise).to.be.rejectedWith(
        TypeError,
        'Sequelize#union: query 1 returns 2 column(s), but query 0 returns 3 column(s)',
      );
    });

    it('throws when member queries have incompatible column types at the same position', async () => {
      const WeirdGuest = sequelize.define(
        'WeirdGuest',
        {
          name: DataTypes.INTEGER, // Incompatible with User.name (STRING)
          age: DataTypes.INTEGER,
        },
        { timestamps: false },
      );

      const promise = sequelize.union([{ model: vars.User }, { model: WeirdGuest }]);

      await expect(promise).to.be.rejectedWith(
        TypeError,
        'Sequelize#union: column at position 1 has incompatible types',
      );
    });

    it('allows member queries with compatible column types at the same position', async () => {
      // FLOAT and DOUBLE are considered compatible 'DECIMAL' types
      const FloatUser = sequelize.define(
        'FloatUser',
        { name: DataTypes.STRING, age: DataTypes.FLOAT },
        { timestamps: false },
      );

      const DoubleGuest = sequelize.define(
        'DoubleGuest',
        { name: DataTypes.STRING, age: DataTypes.DOUBLE },
        { timestamps: false },
      );

      await sequelize.sync({ force: true });
      await FloatUser.create({ name: 'Alice', age: 20.5 });
      await DoubleGuest.create({ name: 'Bob', age: 30.5 });

      const results = await sequelize.union([{ model: FloatUser }, { model: DoubleGuest }]);

      expect(results).to.have.lengthOf(2);
    });

    it('throws when a member query uses the include option', async () => {
      const promise = sequelize.union([
        { model: vars.User, options: { include: 'something' } as any },
        { model: vars.Guest },
      ]);

      await expect(promise).to.be.rejectedWith(
        TypeError,
        'Sequelize#union: query 0 uses the "include" option, but eager-loading is not supported in a UNION',
      );
    });

    for (const optionName of ['limit', 'offset', 'order'] as const) {
      it(`throws when a member query uses the ${optionName} option`, async () => {
        const options = { [optionName]: optionName === 'order' ? ['name'] : 1 };
        const promise = sequelize.union([
          { model: vars.User },
          { model: vars.Guest, options: options as any },
        ]);

        await expect(promise).to.be.rejectedWith(
          TypeError,
          `Sequelize#union: query 1 uses the "${optionName}" option, which is not supported on an individual member of a UNION`,
        );
      });
    }

    it('throws when a scope injects an include', async () => {
      const Team = sequelize.define('Team', { name: DataTypes.STRING }, { timestamps: false });
      const ScopedUser = sequelize.define(
        'ScopedUser',
        { name: DataTypes.STRING },
        { timestamps: false },
      );

      ScopedUser.belongsTo(Team, { as: 'team', foreignKey: 'teamId' });
      ScopedUser.addScope('defaultScope', { include: ['team'] }, { override: true });

      const promise = sequelize.union([{ model: ScopedUser }]);

      await expect(promise).to.be.rejectedWith(
        TypeError,
        'Sequelize#union: the scope applied to query 0 uses the "include" option',
      );
    });

    it('throws when a scope injects a limit', async () => {
      const ScopedUser = sequelize.define(
        'ScopedUser',
        { name: DataTypes.STRING },
        { timestamps: false, defaultScope: { limit: 5 } },
      );

      const promise = sequelize.union([{ model: ScopedUser }]);

      await expect(promise).to.be.rejectedWith(
        TypeError,
        'Sequelize#union: the scope applied to query 0 uses the "limit" option',
      );
    });

    it('does not mutate the options of the caller', async () => {
      const memberOptions = { attributes: ['name'] as const };
      const options = { unionAll: true };

      await sequelize.union(
        [
          { model: vars.User, options: memberOptions },
          { model: vars.Guest, options: memberOptions },
        ],
        options,
      );

      expect(memberOptions).to.deep.equal({ attributes: ['name'] });
      expect(options).to.deep.equal({ unionAll: true });
    });

    if (dialectName === 'oracle' || dialectName === 'db2') {
      it('throws when unioning a TEXT column with another type', async () => {
        const TextGuest = sequelize.define(
          'TextGuest',
          { name: DataTypes.TEXT, age: DataTypes.INTEGER },
          { timestamps: false },
        );

        const promise = sequelize.union([{ model: vars.User }, { model: TextGuest }], {
          unionAll: true,
        });

        await expect(promise).to.be.rejectedWith(
          TypeError,
          /LOB\/CLOB \(TEXT\) columns cannot be unioned with other data types/,
        );
      });

      it('throws when using a duplicate-eliminating UNION on a TEXT column', async () => {
        const TextGuest1 = sequelize.define(
          'TextGuest1',
          { name: DataTypes.TEXT, age: DataTypes.INTEGER },
          { timestamps: false },
        );
        const TextGuest2 = sequelize.define(
          'TextGuest2',
          { name: DataTypes.TEXT, age: DataTypes.INTEGER },
          { timestamps: false },
        );

        const promise = sequelize.union([{ model: TextGuest1 }, { model: TextGuest2 }]);

        await expect(promise).to.be.rejectedWith(
          TypeError,
          /which is not supported in standard duplicate-eliminating UNION queries/,
        );
      });
    }
  });

  describe('transactions', () => {
    if (!sequelize.dialect.supports.transactions) {
      return;
    }

    interface TAccount extends Model<InferAttributes<TAccount>, InferCreationAttributes<TAccount>> {
      name: string;
    }

    let transactionSequelize: Sequelize;
    let Account: any;
    let Contact: any;

    beforeEach(async () => {
      transactionSequelize = await createSingleTransactionalTestSequelizeInstance(sequelize, {
        // The test suite disables CLS transactions by default
        disableClsTransactions: false,
      });

      Account = transactionSequelize.define<TAccount>(
        'Account',
        { name: DataTypes.STRING },
        { timestamps: false },
      );
      Contact = transactionSequelize.define<TAccount>(
        'Contact',
        { name: DataTypes.STRING },
        { timestamps: false },
      );

      await transactionSequelize.sync({ force: true });
    });

    it('inherits the transaction of the surrounding CLS context', async () => {
      await transactionSequelize.transaction(async () => {
        await Account.create({ name: 'Alice' });
        await Contact.create({ name: 'Bob' });

        const results = await transactionSequelize.union([
          { model: Account, options: { attributes: ['name'] } },
          { model: Contact, options: { attributes: ['name'] } },
        ]);

        expect(
          results.map(row => row.name as string).sort((a, b) => a.localeCompare(b)),
        ).to.deep.equal(['Alice', 'Bob']);
      });
    });

    it('accepts an explicitly passed transaction', async () => {
      const transaction = await transactionSequelize.startUnmanagedTransaction();

      try {
        await Account.create({ name: 'Alice' }, { transaction });

        const results = await transactionSequelize.union(
          [{ model: Account, options: { attributes: ['name'] } }],
          { transaction },
        );

        expect(results.map(row => row.name)).to.deep.equal(['Alice']);
      } finally {
        await transaction.rollback();
      }
    });

    it('does not see rows written by an uncommitted transaction it is not part of', async () => {
      const transaction = await transactionSequelize.startUnmanagedTransaction();

      try {
        await Account.create({ name: 'Alice' }, { transaction });

        const results = await transactionSequelize.union([
          { model: Account, options: { attributes: ['name'] } },
        ]);

        expect(results).to.have.lengthOf(0);
      } finally {
        await transaction.rollback();
      }
    });

    it('does not see rows of a rolled back transaction', async () => {
      await transactionSequelize
        .transaction(async () => {
          await Account.create({ name: 'Alice' });

          throw new Error('rollback');
        })
        .catch(() => {
          /* expected */
        });

      const results = await transactionSequelize.union([
        { model: Account, options: { attributes: ['name'] } },
      ]);

      expect(results).to.have.lengthOf(0);
    });
  });
});
