'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types');

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Paranoid'), function() {

  beforeEach(function( ) {
    var S = this.sequelize,
        DT = DataTypes,

        A = this.A = S.define('A', { name: DT.STRING }, { paranoid: true }),
        B = this.B = S.define('B', { name: DT.STRING }, { paranoid: true }),
        C = this.C = S.define('C', { name: DT.STRING }, { paranoid: true }),
        D = this.D = S.define('D', { name: DT.STRING }, { paranoid: true });

    A.belongsTo(B);
    A.hasMany(D);
    A.hasMany(C);

    B.hasMany(A);
    B.hasMany(C);

    C.belongsTo(A);
    C.belongsTo(B);

    D.hasMany(A);

    return S.sync({ force: true });
  });

  it('paranoid with timestamps: false should be ignored / not crash', function() {
    var S = this.sequelize
      , Test = S.define('Test', {
          name: DataTypes.STRING
        },{
          timestamps: false,
          paranoid: true
        });

    return S.sync({ force: true }).then(function() {
      return Test.find(1);
    });
  });

  it('test if non required is marked as false', function( ) {
    var A = this.A,
        B = this.B,
        options = {
          include: [
            {
              model: B,
              required: false
            }
          ]
        };

    return A.find(options).then(function() {
      expect(options.include[0].required).to.be.equal(false);
    });
  });

  it('test if required is marked as true', function( ) {
    var A = this.A,
        B = this.B,
        options = {
          include: [
            {
              model: B,
              required: true
            }
          ]
        };

    return A.find(options).then(function() {
      expect(options.include[0].required).to.be.equal(true);
    });
  });

  it('should not load paranoid, destroyed instances, with a non-paranoid parent', function () {
    var X = this.sequelize.define('x', {
      name: DataTypes.STRING
    }, {
      paranoid: false
    });

    var Y = this.sequelize.define('y', {
      name: DataTypes.STRING
    }, {
      timestamps: true,
      paranoid: true
    });

    X.hasMany(Y);

    return this.sequelize.sync({ force: true}).bind(this).then(function () {
      return this.sequelize.Promise.all([
        X.create(),
        Y.create()
      ]);
    }).spread(function (x, y) {
      this.x = x;
      this.y = y;

      return x.addY(y);
    }).then(function () {
      return this.y.destroy();
    }).then(function () {
      return X.findAll({
        include: [Y]
      }).get(0);
    }).then(function (x) {
      expect(x.ys).to.have.length(0);
    });
  });
});
