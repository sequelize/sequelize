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

    it( 'Try to include a non required model, with conditions and two includes N:M 1:M', function ( done ) {
      var DT = DataTypes,
          S = this.sequelize,
          A = S.define('A', { name: DT.STRING(40) }, { paranoid: true }),
          B = S.define('B', { name: DT.STRING(40) }, { paranoid: true }),
          C = S.define('C', { name: DT.STRING(40) }, { paranoid: true }),
          D = S.define('D', { name: DT.STRING(40) }, { paranoid: true })

      // Associations
      A.hasMany( B )

      B.belongsTo( B )
      B.belongsTo( D )
      B.hasMany( C, {
          through: 'BC',
        })

      C
        .hasMany( B, {
          through: 'BC',
        })

      D
        .hasMany( B )

      S.sync({ force: true }).done( function ( err ) { expect( err ).not.to.be.ok

        A.find({
          include: [
            { model: B, required: false, include: [
              { model: C, required: false },
              { model: D }
            ]}
          ]
        }).done( function ( err ) {
          expect( err ).not.to.be.ok
          done()
        })

      })

    });

    it("should still pull the main record when an included model is not required and has where restrictions without matches", function () {
      var DT = DataTypes,
          S  = this.sequelize,
          A  = S.define( 'A', {name: DT.STRING(40)} ),
          B  = S.define( 'B', {name: DT.STRING(40)} );

      A.hasMany(B);
      B.hasMany(A);

      return S
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
              {model: B, where: {name: 'idontexist'}, require: false}
            ]
          });
        })
        .then(function (a) {
          expect(a).to.not.equal(null);
          expect(a.get('bs')).to.deep.equal([]);
        });
    });

  });

})