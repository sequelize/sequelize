'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , datetime = require('chai-datetime');

chai.use(datetime);
chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Paranoid'), function() {

  beforeEach(function(done ) {
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

    S.sync({ force: true }).done(function(err ) {
      expect(err).not.to.be.ok;
      done();
    });

  });

  it('paranoid with timestamps: false should be ignored / not crash', function(done) {

    var S = this.sequelize,
        Test = S.define('Test', {
          name: DataTypes.STRING
        },{
          timestamps: false,
          paranoid: true
        });

    S.sync({ force: true }).done(function() {
      Test.find(1).done(function(err ) {
        expect(err).to.be.not.ok;
        done();
      });
    });

  });

  it('test if non required is marked as false', function(done ) {

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

    A.find(options).done(function(err ) {
      expect(err).not.to.be.ok;
      expect(options.include[0].required).to.be.equal(false);

      done();
    });

  });

  it('test if required is marked as true', function(done ) {

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

    A.find(options).done(function(err ) {
      expect(err).not.to.be.ok;
      expect(options.include[0].required).to.be.equal(true);

      done();
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
