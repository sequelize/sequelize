var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)

describe('Associations', function() {
  beforeEach(function() { Helpers.sync() })
  afterEach(function() { Helpers.drop() })

  /////////// many-to-many with same prefix ////////////

  describe('many-to-many', function() {
    describe('where tables have the same prefix', function() {
      var Table2 = sequelize.define('wp_table2', {foo: Sequelize.STRING})
        , Table1 = sequelize.define('wp_table1', {foo: Sequelize.STRING})

      Table1.hasMany(Table2)
      Table2.hasMany(Table1)

      it("should create a table wp_table1wp_table2s", function() {
        expect(sequelize.modelManager.getModel('wp_table1swp_table2s')).toBeDefined()
      })
    })
  })

})


describe('Advanced associations', function() {

    /////////// has-one ////////////

    describe('has-one', function() {

      beforeEach(function() { Helpers.sync() })
      afterEach(function() { Helpers.drop() })

      var User = sequelize.define('user', {
        name: Sequelize.STRING
      },{
        underscored : true
      })

      var Profile = sequelize.define('profile', {
        user_id: {
          type: Sequelize.INTEGER,
          primaryKey: true
        },
        dob: Sequelize.DATE
      },{
        underscored : true
      })

      var Profile2 = sequelize.define('profile2', {
        dob: Sequelize.DATE
      },{
        underscored : true
      })

      User.hasOne(Profile)
      User.hasOne(Profile2)


      it("should only allow integer fields to be foreign keys", function() {

        var table1 = sequelize.define('table1', {
          name: Sequelize.STRING
        },{
          underscored : true
        })

        var types = [Sequelize.STRING, Sequelize.TEXT, Sequelize.BOOLEAN, Sequelize.DATE, Sequelize.FLOAT]
        for (var i=0; i<types.length; ++i) {
          var type = types[i]
          var table2 = sequelize.define('table2',{
            table1_id : Sequelize.STRING
          },{
            underscored : true
          })
          try {
            table1.hasOne(table2)
            throw new Error("Shouldn't reach here")
          } catch (err) {
            expect(err.message).toContain("Field table1_id of table2 must be of type INTEGER")
          }
        }

      })


      it("should allow field to be primary key as well as foreign key", function() {
        Helpers.async(function(done){
          var user = User.build({
            name: "test"
          })

          expect(user.profile_id).toBeUndefined()
          expect(user.profile2_id).toBeUndefined()

          user.save().on('success', function(new_user){
            // shared primary key and foreign key
            var profile = Profile.build({
              user_id: new_user.id,
              dob: "2011-01-01 00:00:00"
            })
            expect(profile.id).toBeUndefined()
            expect(profile.user_id).toEqual(new_user.id)

            profile.save().on('success', function(new_profile){

              expect(new_profile.id).toBeUndefined()
              expect(new_profile.user_id).toEqual(new_user.id)

              // try saving a profile with the same user_id again (should fail!)
              var profile_again = Profile.build({
                user_id: new_user.id,
                dob: "2011-01-02 00:00:00"
              })
              profile_again.save().on('failure', function(err){

                // now try saving a Profile2 item
                var profile2 = Profile2.build({
                  user_id: new_user.id,
                  dob: "2011-01-02 00:00:00"
                })
                expect(profile2.id).toBeDefined()
                expect(profile2.user_id).toEqual(new_user.id)

                profile2.save().on('success',function(new_profile2){

                  expect(new_profile2.id).toBeGreaterThan(0)
                  expect(new_profile2.user_id).toEqual(new_user.id)

                  done();

                }).on('failure',function(err){
                  throw new Error('Failed to save profile2: ' + err)
                })

              }).on('success',function(newp){
                throw new Error('Shouldn\'t have saved profile_again')
              })

            }).on('failure',function(err) {
              throw new Error('Failed to save profile1: ' + err)
            })

          }).on('failure',function(err) {
            throw new Error('Failed to save user: ' + err)
          })

        }) // async wrapper

      }) // it("should allow field to be primary key as well as foreign key")
    }) // describe('has-one')


    /////////// belongs-to ////////////

    describe('belongs-to', function() {

      beforeEach(function() { Helpers.sync() })
      afterEach(function() { Helpers.drop() })

      var User = sequelize.define('user', {
        name: Sequelize.STRING
      },{
        underscored : true
      })

      var Profile = sequelize.define('profile', {
        user_id: {
          type: Sequelize.INTEGER,
          primaryKey: true
        },
        dob: Sequelize.DATE
      },{
        underscored : true
      })

      var Profile2 = sequelize.define('profile2', {
        dob: Sequelize.DATE
      },{
        underscored : true
      })

      Profile.belongsTo(User)
      Profile2.belongsTo(User)

      it("should only allow integer fields to be foreign keys", function() {

        var table1 = sequelize.define('table1', {
          name: Sequelize.STRING
        },{
          underscored : true
        })

        var types = [Sequelize.STRING, Sequelize.TEXT, Sequelize.BOOLEAN, Sequelize.DATE, Sequelize.FLOAT]
        for (var i=0; i<types.length; ++i) {
          var type = types[i]
          var table2 = sequelize.define('table2',{
            table1_id : Sequelize.STRING
          },{
            underscored : true
          })
          try {
            table2.belongsTo(table1)
            throw new Error("Shouldn't reach here")
          } catch (err) {
            expect(err.message).toContain("Field table1_id of table2 must be of type INTEGER")
          }
        }

      })


      it("should allow field to be primary key as well as foreign key", function() {
        Helpers.async(function(done){
          var user = User.build({
            name: "test"
          })

          expect(user.profile_id).toBeUndefined()
          expect(user.profile2_id).toBeUndefined()

          user.save().on('success', function(new_user){
            // shared primary key and foreign key
            var profile = Profile.build({
              user_id: new_user.id,
              dob: "2011-01-01 00:00:00"
            })
            expect(profile.id).toBeUndefined()
            expect(profile.user_id).toEqual(new_user.id)

            profile.save().on('success', function(new_profile){

              expect(new_profile.id).toBeUndefined()
              expect(new_profile.user_id).toEqual(new_user.id)

              // try saving a profile with the same user_id again (should fail!)
              var profile_again = Profile.build({
                user_id: new_user.id,
                dob: "2011-01-02 00:00:00"
              })
              profile_again.save().on('failure', function(err){

                // now try saving a Profile2 item
                var profile2 = Profile2.build({
                  user_id: new_user.id,
                  dob: "2011-01-02 00:00:00"
                })
                expect(profile2.id).toBeDefined()
                expect(profile2.user_id).toEqual(new_user.id)

                profile2.save().on('success',function(new_profile2){

                  expect(new_profile2.id).toBeGreaterThan(0)
                  expect(new_profile2.user_id).toEqual(new_user.id)

                  done();

                }).on('failure',function(err){
                  throw new Error('Failed to save profile2: ' + err)
                })

              }).on('success',function(newp){
                throw new Error('Shouldn\'t have saved profile_again')
              })

            }).on('failure',function(err) {
              throw new Error('Failed to save profile1: ' + err)
            })

          }).on('failure',function(err) {
            throw new Error('Failed to save user: ' + err)
          })

        }) // async wrapper

      }) // it("should allow field to be primary key as well as foreign key")
    }) // describe('has-one')


    /////////// has-many ////////////

    describe('has-many', function() {

      beforeEach(function() { Helpers.sync() })
      afterEach(function() { Helpers.drop() })

      var User = sequelize.define('user', {
        name: Sequelize.STRING
      },{
        underscored : true
      })

      var Profile = sequelize.define('profile', {
        user_id: {
          type: Sequelize.INTEGER,
          primaryKey: true
        },
        dob: Sequelize.DATE
      },{
        underscored : true
      })

      var Profile2 = sequelize.define('profile2', {
        dob: Sequelize.DATE
      },{
        underscored : true
      })

      User.hasMany(Profile)
      User.hasMany(Profile2)

      it("should only allow integer fields to be foreign keys", function() {

        var table1 = sequelize.define('table1', {
          name: Sequelize.STRING
        },{
          underscored : true
        })

        var types = [Sequelize.STRING, Sequelize.TEXT, Sequelize.BOOLEAN, Sequelize.DATE, Sequelize.FLOAT]
        for (var i=0; i<types.length; ++i) {
          var type = types[i]
          var table2 = sequelize.define('table2',{
            table1_id : Sequelize.STRING
          },{
            underscored : true
          })
          try {
            table1.hasMany(table2)
            throw new Error("Shouldn't reach here")
          } catch (err) {
            expect(err.message).toContain("Field table1_id of table2 must be of type INTEGER")
          }
        }

      })


      it("should allow field to be primary key as well as foreign key", function() {
        Helpers.async(function(done){
          var user = User.build({
            name: "test"
          })

          expect(user.profile_id).toBeUndefined()
          expect(user.profile2_id).toBeUndefined()

          user.save().on('success', function(new_user){
            // shared primary key and foreign key
            var profile = Profile.build({
              user_id: new_user.id,
              dob: "2011-01-01 00:00:00"
            })
            expect(profile.id).toBeUndefined()
            expect(profile.user_id).toEqual(new_user.id)

            profile.save().on('success', function(new_profile){

              expect(new_profile.id).toBeUndefined()
              expect(new_profile.user_id).toEqual(new_user.id)

              // try saving a profile with the same user_id again (should fail!)
              var profile_again = Profile.build({
                user_id: new_user.id,
                dob: "2011-01-02 00:00:00"
              })
              profile_again.save().on('failure', function(err){

                // now try saving a Profile2 item
                var profile2 = Profile2.build({
                  user_id: new_user.id,
                  dob: "2011-01-02 00:00:00"
                })
                expect(profile2.id).toBeDefined()
                expect(profile2.user_id).toEqual(new_user.id)

                profile2.save().on('success',function(new_profile2){

                  expect(new_profile2.id).toBeGreaterThan(0)
                  expect(new_profile2.user_id).toEqual(new_user.id)

                  done();

                }).on('failure',function(err){
                  throw new Error('Failed to save profile2: ' + err)
                })

              }).on('success',function(newp){
                throw new Error('Shouldn\'t have saved profile_again')
              })

            }).on('failure',function(err) {
              throw new Error('Failed to save profile1: ' + err)
            })

          }).on('failure',function(err) {
            throw new Error('Failed to save user: ' + err)
          })

        }) // async wrapper

      }) // it("should allow field to be primary key as well as foreign key")
    }) // describe('has-one')


}) // describe('Advanced associations')


