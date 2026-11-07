'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Paranoid'), () => {
  beforeEach(async function () {
    const S = this.sequelize;
    const DT = DataTypes;

    const A = (this.A = S.define('A', { name: DT.STRING }, { paranoid: true }));
    const B = (this.B = S.define('B', { name: DT.STRING }, { paranoid: true }));
    const C = (this.C = S.define('C', { name: DT.STRING }, { paranoid: true }));
    const D = (this.D = S.define('D', { name: DT.STRING }, { paranoid: true }));

    A.belongsTo(B);
    A.belongsToMany(D, { through: 'a_d' });
    A.hasMany(C);

    B.hasMany(A);
    B.hasMany(C);

    C.belongsTo(A);
    C.belongsTo(B);

    D.belongsToMany(A, { through: 'a_d' });

    await S.sync({ force: true });
  });

  before(function () {
    this.clock = Support.useFakeTimers();
  });

  after(function () {
    this.clock.restore();
  });

  describe('deleted-at attribute and column name collisions', () => {
    beforeEach(async function () {
      const Parent = this.sequelize.define('Parent', {}, { timestamps: false });
      const Item = this.sequelize.define(
        'Item',
        {
          id: { type: DataTypes.INTEGER, primaryKey: true },
          removedAt: { type: DataTypes.DATE, columnName: 'removed_at' },
          removed_at: { type: DataTypes.DATE, columnName: 'other_date' },
        },
        { paranoid: true, deletedAt: 'removedAt' },
      );
      Parent.hasMany(Item, { as: 'items', foreignKey: 'parentId' });
      Parent.belongsToMany(Parent, {
        as: 'targets',
        inverse: { as: 'sources' },
        through: Item,
        foreignKey: 'sourceId',
        otherKey: 'targetId',
      });
      await this.sequelize.sync({ force: true });
      await Parent.bulkCreate([{ id: 1 }, { id: 2 }, { id: 3 }]);
      await Item.bulkCreate([
        { id: 1, parentId: 1, sourceId: 1, targetId: 2, removed_at: new Date(0) },
        { id: 2, parentId: 1, sourceId: 1, targetId: 3, removedAt: new Date(1000) },
      ]);
      this.Parent = Parent;
    });

    it('filters recursive includes using the included model and alias', async function () {
      const parent = await this.Parent.findByPk(1, {
        include: [{ association: 'targets', include: ['sources'] }, 'items'],
      });
      expect(parent.items.map(item => item.id)).to.deep.equal([1]);
      expect(parent.targets.map(target => target.id)).to.deep.equal([2]);
      expect(parent.targets[0].sources.map(source => source.id)).to.deep.equal([1]);
      const all = await this.Parent.findByPk(1, {
        include: [{ association: 'items', paranoid: false }],
      });
      expect(all.items.map(item => item.id).sort()).to.deep.equal([1, 2]);
    });

    it('filters through aliases and respects the through paranoid opt-out', async function () {
      const parent = await this.Parent.findByPk(1, { include: ['targets'] });
      expect(parent.targets.map(target => target.id)).to.deep.equal([2]);
      const all = await this.Parent.findByPk(1, {
        include: [{ association: 'targets', through: { paranoid: false } }],
      });
      expect(all.targets.map(target => target.id).sort()).to.deep.equal([2, 3]);
    });
  });

  it('paranoid with timestamps: false should be ignored / not crash', async function () {
    const S = this.sequelize;
    const Test = S.define(
      'Test',
      {
        name: DataTypes.STRING,
      },
      {
        timestamps: false,
        paranoid: true,
      },
    );

    await S.sync({ force: true });

    await Test.findByPk(1);
  });

  it('test if non required is marked as false', async function () {
    const A = this.A;
    const B = this.B;
    const options = {
      include: [
        {
          model: B,
          required: false,
        },
      ],
    };

    await A.findOne(options);
    expect(options.include[0].required).to.equal(false);
  });

  it('test if required is marked as true', async function () {
    const A = this.A;
    const B = this.B;
    const options = {
      include: [
        {
          model: B,
          required: true,
        },
      ],
    };

    await A.findOne(options);
    expect(options.include[0].required).to.equal(true);
  });

  it('should not load paranoid, destroyed instances, with a non-paranoid parent', async function () {
    const X = this.sequelize.define(
      'x',
      {
        name: DataTypes.STRING,
      },
      {
        paranoid: false,
      },
    );

    const Y = this.sequelize.define(
      'y',
      {
        name: DataTypes.STRING,
      },
      {
        timestamps: true,
        paranoid: true,
      },
    );

    X.hasMany(Y);

    await this.sequelize.sync({ force: true });

    const [x0, y] = await Promise.all([X.create(), Y.create()]);

    this.x = x0;
    this.y = y;

    await x0.addY(y);
    await this.y.destroy();
    // prevent CURRENT_TIMESTAMP to be same
    this.clock.tick(1000);

    const obj = await X.findAll({
      include: [Y],
    });

    const x = await obj[0];
    expect(x.ys).to.have.length(0);
  });
});
