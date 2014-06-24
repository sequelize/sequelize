/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , datetime  = require('chai-datetime')

chai.use(datetime)
chai.config.includeStack = true

describe(Support.getTestDialectTeaser("Include"), function () {
  describe('find', function () {
    it('should include a non required model, with conditions and two includes N:M 1:M', function ( done ) {
      var A = this.sequelize.define('A', { name: DataTypes.STRING(40) }, { paranoid: true })
        , B = this.sequelize.define('B', { name: DataTypes.STRING(40) }, { paranoid: true })
        , C = this.sequelize.define('C', { name: DataTypes.STRING(40) }, { paranoid: true })
        , D = this.sequelize.define('D', { name: DataTypes.STRING(40) }, { paranoid: true });

      // Associations
      A.hasMany(B);

      B.belongsTo(B);
      B.belongsTo(D);
      B.hasMany(C, {
        through: 'BC',
      });

      C.hasMany(B, {
        through: 'BC',
      });

      D.hasMany(B);

      this.sequelize.sync({ force: true }).done(function ( err ) {
        expect( err ).not.to.be.ok;

        A.find({
          include: [
            { model: B, required: false, include: [
              { model: C, required: false },
              { model: D }
            ]}
          ]
        }).done( function ( err ) {
          expect( err ).not.to.be.ok;
          done();
        });
      });

    });

    it("should still pull the main record when an included model is not required and has where restrictions without matches", function () {
      var A = this.sequelize.define('A', {
          name: DataTypes.STRING(40)
        })
        , B = this.sequelize.define('B', {
          name: DataTypes.STRING(40)
        });

      A.hasMany(B);
      B.hasMany(A);

      return this.sequelize
        .sync({force: true})
        .then(function () {
          return A.create({
            name: 'Foobar'
          });
        })
        .then(function () {
          return A.find({
            where: {name: 'Foobar'},
            include: [
              {model: B, where: {name: 'idontexist'}, required: false}
            ]
          });
        })
        .then(function (a) {
          expect(a).to.not.equal(null);
          expect(a.get('bs')).to.deep.equal([]);
        });
    });
  });
});