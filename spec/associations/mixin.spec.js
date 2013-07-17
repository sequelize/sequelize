if (typeof require === 'function') {
  const buster    = require("buster")
      , Helpers   = require('../buster-helpers')
      , Sequelize = require('../../index')
      , dialect   = Helpers.getTestDialect()
}

buster.spec.expose()

describe(Helpers.getTestDialectTeaser("Mixin"), function() {
  before(function(done) {
    Helpers.initTests({
      dialect: dialect,
      beforeComplete: function(sequelize) {
        this.sequelize = sequelize
      }.bind(this),
      onComplete: done
    })
  })

  describe('Mixin', function() {
    var DAOFactory = require("../../lib/dao-factory")

    it("adds the mixed-in functions to the dao", function() {
      expect(DAOFactory.prototype.hasOne).toBeDefined()
      expect(DAOFactory.prototype.hasMany).toBeDefined()
      expect(DAOFactory.prototype.belongsTo).toBeDefined()
    })
  })

  describe('getAssociation', function() {
    it('returns the respective part of the association for 1:1 associations', function() {
      var User = this.sequelize.define('User', {})
      var Task = this.sequelize.define('Task', {})

      User.hasOne(Task)
      Task.belongsTo(User)

      expect(User.getAssociation(Task).target).toEqual(Task)
    })

    it('can handle multiple associations just fine', function(done) {
      var Emit  = require('events').EventEmitter
        , emit = new Emit()
        , User  = this.sequelize.define('User', { username: Sequelize.STRING })
        , Event = this.sequelize.define('Event', { name: Sequelize.STRING })
        , Place = this.sequelize.define('Place', { name: Sequelize.STRING })
        , theSQL = ''
        , count = 0
        , theEvent

      Event.belongsTo(User)
      Event.hasOne(Place)

      emit.on('sql', function(sql){
        ++count
        theSQL = sql
        if (count > 1) {
          emit.emit('spy')
        }
      })

      emit.on('find', function(e) {
        ++count
        theEvent = e
        if (count > 1) {
          emit.emit('spy')
        }
      })

      emit.on('spy', function(){
        expect(theSQL.match(/WHERE ["`]Events["`].["`]id["`]=1;$/)).not.toBeNull()
        expect(theEvent.name).toEqual('Bob Marley Concert')
        expect(theEvent.place.name).toEqual('Backyard')
        expect(theEvent.user.username).toEqual('Dan')
        done()
      })

      this.sequelize.sync({force: true }).success(function() {
        User.create({username: 'Dan'}).success(function(user){
          Event.create({name: 'Bob Marley Concert'}).success(function(event) {
            Place.create({name: 'Backyard'}).success(function(place) {
              event.setUser(user).success(function(){
                event.setPlace(place).success(function(){
                  Event.find({where: {id: 1}, include: [User, Place]}).success(function(theEvent){
                    emit.emit('find', theEvent)
                  })
                  .on('sql', function(sql){
                    emit.emit('sql', sql)
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})
