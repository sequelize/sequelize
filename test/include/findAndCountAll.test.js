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
  describe('findAndCountAll', function () {

    it( 'Try to include a required model. Result rows should match count', function ( done ) {
      var DT = DataTypes,
          S = this.sequelize,
          User = S.define('User', { name: DT.STRING(40) }, { paranoid: true }),
          SomeConnection = S.define('SomeConnection', {
            m: DT.STRING(40),
            fk: DT.INTEGER,
            u: DT.INTEGER,
          }, { paranoid: true }),
          A = S.define('A', { name: DT.STRING(40) }, { paranoid: true }),
          B = S.define('B', { name: DT.STRING(40) }, { paranoid: true }),
          C = S.define('C', { name: DT.STRING(40) }, { paranoid: true })

      // Associate them
      User.hasMany( SomeConnection, { foreignKey: 'u' })

      SomeConnection
        .belongsTo( User, { foreignKey: 'u' })
        .belongsTo( A, { foreignKey: 'fk' })
        .belongsTo( B, { foreignKey: 'fk' })
        .belongsTo( C, { foreignKey: 'fk' })

      A.hasMany( SomeConnection, { foreignKey: 'fk' })
      B.hasMany( SomeConnection, { foreignKey: 'fk' })
      C.hasMany( SomeConnection, { foreignKey: 'fk' })

      // Sync them
      S.sync({ force: true }).done( function ( err ) { expect( err ).not.to.be.ok;

        // Create an enviroment
        User.bulkCreate([
          { name: 'Youtube' },
          { name: 'Facebook' },
          { name: 'Google' },
          { name: 'Yahoo' },
          { name: '404' }
        ]).done( function ( err, users ) { expect( err ).not.to.be.ok; expect( users ).to.be.length( 5 )

        SomeConnection.bulkCreate([ // Lets count, m: A and u: 1
          { u: 1, m: 'A', fk: 1 }, // 1  // Will be deleted
          { u: 2, m: 'A', fk: 1 },
          { u: 3, m: 'A', fk: 1 },
          { u: 4, m: 'A', fk: 1 },
          { u: 5, m: 'A', fk: 1 },
          { u: 1, m: 'B', fk: 1 },
          { u: 2, m: 'B', fk: 1 },
          { u: 3, m: 'B', fk: 1 },
          { u: 4, m: 'B', fk: 1 },
          { u: 5, m: 'B', fk: 1 },
          { u: 1, m: 'C', fk: 1 },
          { u: 2, m: 'C', fk: 1 },
          { u: 3, m: 'C', fk: 1 },
          { u: 4, m: 'C', fk: 1 },
          { u: 5, m: 'C', fk: 1 },
          { u: 1, m: 'A', fk: 2 }, // 2 // Will be deleted
          { u: 4, m: 'A', fk: 2 },
          { u: 2, m: 'A', fk: 2 },
          { u: 1, m: 'A', fk: 3 }, // 3
          { u: 2, m: 'A', fk: 3 },
          { u: 3, m: 'A', fk: 3 },
          { u: 2, m: 'B', fk: 2 },
          { u: 1, m: 'A', fk: 4 }, // 4
          { u: 4, m: 'A', fk: 2 },
        ]).done( function ( err, conns ) { expect( err ).not.to.be.ok; expect( conns ).to.be.length( 24 )

        A.bulkCreate([
          { name: 'Just' },
          { name: 'for' },
          { name: 'testing' },
          { name: 'proposes' },
          { name: 'only' },
        ]).done( function ( err, as ) { expect( err ).not.to.be.ok; expect( as ).to.be.length( 5 )

        B.bulkCreate([
          { name: 'this should not' },
          { name: 'be loaded' }
        ]).done( function ( err, bs ) { expect( err ).not.to.be.ok; expect( bs ).to.be.length( 2 )

        C.bulkCreate([
          { name: 'because we only want A' }
        ]).done( function ( err, cs ) { expect( err ).not.to.be.ok; expect( cs ).to.be.length( 1 )

          // Delete some of conns to prove the concept
          SomeConnection.destroy({
            m: 'A',
            u: 1,
            fk: [ 1, 2 ],
          }).done( function ( err ) { expect( err ).not.to.be.ok

            // Last and most important queries ( we connected 4, but deleted 2, witch means we must get 2 only )
            A.findAndCountAll({

              include: [{
                model: SomeConnection, required: true,
                where: {
                  m: 'A', // Pseudo Polymorphy
                  u: 1
                }
              }],

              limit: 5,

            })
            .done( function ( err, result ) {

              // Test variables
              expect( err ).not.to.be.ok
              expect( result.count ).to.be.equal( 2 )
              expect( result.rows.length ).to.be.equal( 2 )

              done()

            // Last and most important queries - END
            })

          // Delete some of conns to prove the concept - END
          })

        // Create an enviroment - END
        })
        })
        })
        })
        })

      // Sync them - END
      })

    })

  })
})