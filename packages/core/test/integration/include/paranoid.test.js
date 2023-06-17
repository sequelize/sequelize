'use strict';

const chai = require('chai');

const expect = chai.expect;
const sinon = require('sinon');
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Paranoid'), () => {

  beforeEach(async function () {
    const S = this.sequelize;
    const DT = DataTypes;

    const A = this.A = S.define('A', { name: DT.STRING }, { paranoid: true });
    const B = this.B = S.define('B', { name: DT.STRING }, { paranoid: true });
    const C = this.C = S.define('C', { name: DT.STRING }, { paranoid: true });
    const D = this.D = S.define('D', { name: DT.STRING }, { paranoid: true });

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
    this.clock = sinon.useFakeTimers();
  });

  after(function () {
    this.clock.restore();
  });

  it('paranoid with timestamps: false should be ignored / not crash', async function () {
    const S = this.sequelize;
    const Test = S.define('Test', {
      name: DataTypes.STRING,
    }, {
      timestamps: false,
      paranoid: true,
    });

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
    const X = this.sequelize.define('x', {
      name: DataTypes.STRING,
    }, {
      paranoid: false,
    });

    const Y = this.sequelize.define('y', {
      name: DataTypes.STRING,
    }, {
      timestamps: true,
      paranoid: true,
    });

    X.hasMany(Y);

    await this.sequelize.sync({ force: true });

    const [x0, y] = await Promise.all([
      X.create(),
      Y.create(),
    ]);

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
