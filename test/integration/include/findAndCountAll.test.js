'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Promise = require('bluebird');

describe(Support.getTestDialectTeaser('Include'), function() {
  describe('findAndCountAll', function() {
    it('should be able to include a required model. Result rows should match count', function() {
      var User = this.sequelize.define('User', { name: DataTypes.STRING(40) }, { paranoid: true }),
          SomeConnection = this.sequelize.define('SomeConnection', {
            m: DataTypes.STRING(40),
            fk: DataTypes.INTEGER,
            u: DataTypes.INTEGER
          }, { paranoid: true }),
          A = this.sequelize.define('A', { name: DataTypes.STRING(40) }, { paranoid: true }),
          B = this.sequelize.define('B', { name: DataTypes.STRING(40) }, { paranoid: true }),
          C = this.sequelize.define('C', { name: DataTypes.STRING(40) }, { paranoid: true });

      // Associate them
      User.hasMany(SomeConnection, { foreignKey: 'u', constraints: false });

      SomeConnection.belongsTo(User, { foreignKey: 'u', constraints: false });
      SomeConnection.belongsTo(A, { foreignKey: 'fk', constraints: false });
      SomeConnection.belongsTo(B, { foreignKey: 'fk', constraints: false });
      SomeConnection.belongsTo(C, { foreignKey: 'fk', constraints: false });

      A.hasMany(SomeConnection, { foreignKey: 'fk', constraints: false });
      B.hasMany(SomeConnection, { foreignKey: 'fk', constraints: false });
      C.hasMany(SomeConnection, { foreignKey: 'fk', constraints: false });

      // Sync them
      return this.sequelize.sync({ force: true }).then(function () {
        // Create an enviroment

        return Promise.join(
          User.bulkCreate([
            { name: 'Youtube' },
            { name: 'Facebook' },
            { name: 'Google' },
            { name: 'Yahoo' },
            { name: '404' }
          ]),
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
            { u: 4, m: 'A', fk: 2 }
          ]),
          A.bulkCreate([
            { name: 'Just' },
            { name: 'for' },
            { name: 'testing' },
            { name: 'proposes' },
            { name: 'only' }
          ]),
          B.bulkCreate([
            { name: 'this should not' },
            { name: 'be loaded' }
          ]),
          C.bulkCreate([
            { name: 'because we only want A' }
          ])
        ).then(function () {

          // Delete some of conns to prove the concept
          return SomeConnection.destroy({where: {
            m: 'A',
            u: 1,
            fk: [1, 2]
          }}).then(function() {
            // Last and most important queries ( we connected 4, but deleted 2, witch means we must get 2 only )
            return A.findAndCountAll({
              include: [{
                model: SomeConnection, required: true,
                where: {
                  m: 'A', // Pseudo Polymorphy
                  u: 1
                }
              }],
              limit: 5
            }).then(function(result ) {
              expect(result.count).to.be.equal(2);
              expect(result.rows.length).to.be.equal(2);
            });
          });
        });
      });
    });

    it('should count on a where', function() {
      var Project = this.sequelize.define('Project', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        project_name: { type: DataTypes.STRING}
      });

      var User = this.sequelize.define('User', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        user_name: { type: DataTypes.STRING }
      });

      User.hasMany(Project);

      var userId = null;

      return User.sync({force: true}).then(function() {
        return Project.sync({force: true});
      }).then(function() {
        return Promise.all([User.create(), Project.create(), Project.create(), Project.create()]);
      }).then(function(results) {
        var user = results[0];
        userId = user.id;
        return user.setProjects([results[1], results[2], results[3]]);
      }).then(function() {
        return User.findAndCountAll({
          where: {id: userId},
          include: [Project],
          distinct: true
        });
      }).then(function(result) {
        expect(result.rows.length).to.equal(1);
        expect(result.rows[0].Projects.length).to.equal(3);
        expect(result.count).to.equal(1);
      });
    });

    it('should return the correct count and rows when using a required belongsTo and a limit', function() {
      var s = this.sequelize
        , Foo = s.define('Foo', {})
        , Bar = s.define('Bar', {});

      Foo.hasMany(Bar);
      Bar.belongsTo(Foo);

      return s.sync({ force: true }).then(function() {
        // Make five instances of Foo
        return Foo.bulkCreate([{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}]);
      }).then(function() {
        // Make four instances of Bar, related to the last four instances of Foo
        return Bar.bulkCreate([{'FooId': 2}, {'FooId': 3}, {'FooId': 4}, {'FooId': 5}]);
      }).then(function() {
        // Query for the first two instances of Foo which have related Bars
        return Foo.findAndCountAll({
          include: [{ model: Bar, required: true }],
          limit: 2
        }).tap(function() {
          return Foo.findAll({
            include: [{ model: Bar, required: true }],
            limit: 2
          }).then(function(items) {
            expect(items.length).to.equal(2);
          });
        });
      }).then(function(result) {
        expect(result.count).to.equal(4);

        // The first two of those should be returned due to the limit (Foo
        // instances 2 and 3)
        expect(result.rows.length).to.equal(2);
      });
    });

    it('should return the correct count and rows when using a required belongsTo with a where condition and a limit', function() {
      var Foo = this.sequelize.define('Foo', {})
        , Bar = this.sequelize.define('Bar', {m: DataTypes.STRING(40)});

      Foo.hasMany(Bar);
      Bar.belongsTo(Foo);

      return this.sequelize.sync({ force: true }).then(function() {
        return Foo.bulkCreate([{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}]);
      }).then(function() {
        // Make four instances of Bar, related to the first two instances of Foo
        return Bar.bulkCreate([{'FooId': 1, m:'yes'}, {'FooId': 1, m:'yes'}, {'FooId': 1, m: 'no'}, {'FooId': 2, m: 'yes'}]);
      }).then(function() {
        // Query for the first instance of Foo which have related Bars with m === 'yes'
        return Foo.findAndCountAll({
          include: [{ model: Bar, where: { m: 'yes' } }],
          limit: 1,
          distinct: true
        });
      }).then(function(result) {
        // There should be 2 instances matching the query (Instances 1 and 2), see the findAll statement
        expect(result.count).to.equal(2);

        // The first one of those should be returned due to the limit (Foo instance 1)
        expect(result.rows.length).to.equal(1);
      });
    });

    it('should correctly filter, limit and sort when multiple includes and types of associations are present.', function() {
      var TaskTag = this.sequelize.define('TaskTag', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING}
      });

      var Tag = this.sequelize.define('Tag', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING}
      });

      var Task = this.sequelize.define('Task', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING}
      });
      var Project = this.sequelize.define('Project', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        m: { type: DataTypes.STRING}
      });

      var User = this.sequelize.define('User', {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING }
      });

      Project.belongsTo(User);
      Task.belongsTo(Project);
      Task.belongsToMany(Tag, {through: TaskTag});
      // Sync them
      return this.sequelize.sync({ force: true }).then(function() {
        // Create an enviroment
        return User.bulkCreate([
          { name: 'user-name-1' },
          { name: 'user-name-2' }
        ]).then(function(u){
          return Project.bulkCreate([
            { m: 'A', UserId: 1},
            { m: 'A', UserId: 2},
          ]);
        }).then(function(p){
          return Task.bulkCreate([
            { ProjectId: 1, name: 'Just' },
            { ProjectId: 1, name: 'for' },
            { ProjectId: 2, name: 'testing' },
            { ProjectId: 2, name: 'proposes' }
          ]);
        })
        .then(function() {
          // Find All Tasks with Project(m=a) and User(name=user-name-2)
          return Task.findAndCountAll({
            limit: 1,
            offset: 0,
            order: [[ 'id', 'DESC' ]],
            include: [
              {
                model: Project,
                where: { '$and': [ { m: 'A' } ] } ,
                include: [ {
                    model: User,
                    where: { '$and': [ { name: 'user-name-2' } ] }
                  }
                ]
              },
              { model : Tag }
            ]
          });
        });
      }).then(function(result) {
          expect(result.count).to.equal(2);
          expect(result.rows.length).to.equal(1);
      });
    });
  });
});
