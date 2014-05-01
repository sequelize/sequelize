/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , datetime  = require('chai-datetime')

chai.use(datetime)
chai.config.includeStack = true

describe(Support.getTestDialectTeaser("Paranoid"), function () {

  beforeEach(function ( done ) {
    var S = this.sequelize,
        DT = DataTypes,

        A = this.A = S.define( 'A', { name: DT.STRING }, { paranoid: true }),
        B = this.B = S.define( 'B', { name: DT.STRING }, { paranoid: true }),
        C = this.C = S.define( 'C', { name: DT.STRING }, { paranoid: true }),
        D = this.D = S.define( 'D', { name: DT.STRING }, { paranoid: true })

    A
      .belongsTo( B )
      .hasMany( D )
      .hasMany( C )

    B
      .hasMany( A )
      .hasMany( C )

    C
      .belongsTo( A )
      .belongsTo( B )

    D
      .hasMany( A )

    S.sync({ force: true }).done(function ( err ) {
      expect( err ).not.to.be.ok
      done()
    })

  })

  it( 'test if default required behavior is marked as false', function ( done ) {

    var A = this.A,
        B = this.B,
        options = {
          include: [
            {
              model: B,
            }
          ],
        }

    A.find( options ).done(function ( err ) {
      expect( err ).not.to.be.ok
      expect( options.include[0].required ).to.be.equal( false )

      done()
    })

  })

  it( 'test if non required is marked as false', function ( done ) {

    var A = this.A,
        B = this.B,
        options = {
          include: [
            {
              model: B,
              required: false,
            }
          ],
        }

    A.find( options ).done(function ( err ) {
      expect( err ).not.to.be.ok
      expect( options.include[0].required ).to.be.equal( false )

      done()
    })

  })

  it( 'test if required is marked as true', function ( done ) {

    var A = this.A,
        B = this.B,
        options = {
          include: [
            {
              model: B,
              required: true,
            }
          ],
        }

    A.find( options ).done(function ( err ) {
      expect( err ).not.to.be.ok
      expect( options.include[0].required ).to.be.equal( true )

      done()
    })

  })
})