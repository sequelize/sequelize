/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , Sequelize = require(__dirname + '/../../index')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , datetime  = require('chai-datetime')
  , async     = require('async');

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

    it('should include a model with a where condition but no required', function () {
      var User = this.sequelize.define('User', {}, { paranoid: false })
        , Task = this.sequelize.define('Task', {
          deletedAt: {
            type: DataTypes.DATE
          }
        }, { paranoid: false });

      User.hasMany(Task, {foreignKey: 'userId'});
      Task.belongsTo(User, {foreignKey: 'userId'});

      return this.sequelize.sync({
        force: true
      }).then(function () {
        return User.create();
      }).then(function (user) {
        return Task.bulkCreate([
          {userId: user.get('id'), deletedAt: new Date()},
          {userId: user.get('id'), deletedAt: new Date()},
          {userId: user.get('id'), deletedAt: new Date()}
        ]);
      }).then(function () {
        return User.find({
          include: [
            {model: Task, where: {deletedAt: null}, required: false}
          ]
        });
      }).then(function (user) {
        expect(user).to.be.ok;
        expect(user.Tasks.length).to.equal(0);
      });
    });

    it("should still pull the main record when an included model is not required and has where restrictions without matches", function () {
      var A = this.sequelize.define('a', {
          name: DataTypes.STRING(40)
        })
        , B = this.sequelize.define('b', {
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

    it('should support a nested include (with a where)', function() {
      var A = this.sequelize.define('A', {
        name: DataTypes.STRING
      });

      var B = this.sequelize.define('B', {
        flag: DataTypes.BOOLEAN
      });

      var C = this.sequelize.define('C', {
        name: DataTypes.STRING
      });

      A.hasOne(B);
      B.belongsTo(A);

      B.hasMany(C);
      C.belongsTo(B);

      return this.sequelize
        .sync({ force: true })
        .then(function () {
          return A.find({
            include: [
              {
                model: B,
                where: { flag: true },
                include: [
                  {
                    model: C
                  }
                ]
              }
            ]
          })
        })
        .then(function (a) {
          expect(a).to.not.exist;
        });
    });

    it('should support many levels of belongsTo (with a lower level having a where)', function (done) {
      var A = this.sequelize.define('a', {})
        , B = this.sequelize.define('b', {})
        , C = this.sequelize.define('c', {})
        , D = this.sequelize.define('d', {})
        , E = this.sequelize.define('e', {})
        , F = this.sequelize.define('f', {})
        , G = this.sequelize.define('g', {
          name: DataTypes.STRING
        })
        , H = this.sequelize.define('h', {
          name: DataTypes.STRING
        });

      A.belongsTo(B);
      B.belongsTo(C);
      C.belongsTo(D);
      D.belongsTo(E);
      E.belongsTo(F);
      F.belongsTo(G);
      G.belongsTo(H);

      var b, singles = [
        B,
        C,
        D,
        E,
        F,
        G,
        H
      ];

      this.sequelize.sync().done(function () {
        async.auto({
          a: function (callback) {
            A.create({}).done(callback);
          },
          singleChain: function (callback) {
            var previousInstance;

            async.eachSeries(singles, function (model, callback) {
              var values = {};

              if (model.name === 'g') {
                values.name = 'yolo';
              }
              model.create(values).done(function (err, instance) {
                if (previousInstance) {
                  previousInstance["set"+Sequelize.Utils.uppercaseFirst(model.name)](instance).done(function () {
                    previousInstance = instance;
                    callback();
                  });
                } else {
                  previousInstance = b = instance;
                  callback();
                }
              });
            }, callback);
          },
          ab: ['a', 'singleChain', function (callback, results) {
            results.a.setB(b).done(callback);
          }]
        }, function () {

          A.find({
            include: [
              {model: B, include: [
                {model: C, include: [
                  {model: D, include: [
                    {model: E, include: [
                      {model: F, include: [
                        {model: G, where: {
                          name: 'yolo'
                        }, include: [
                          {model: H}
                        ]}
                      ]}
                    ]}
                  ]}
                ]}
              ]}
            ]
          }).done(function (err, a) {
            expect(err).not.to.be.ok;
            expect(a.b.c.d.e.f.g.h).to.be.ok;
            done();
          });
        });
      });
    });
    
    it('should include a model with a complex filter using a through N:M association', function () {
      var User = this.sequelize.define('User', {}, { paranoid: false })
        , List = this.sequelize.define('List', {}, { paranoid: false })
        , SharedLists = this.sequelize.define('SharedLists', {}, { paranoid: false });

      List.belongsTo(User, { as: 'Owner', foreignKey: 'OwnerId' });
      List.hasMany(User, { as: 'SharedUsers', through: SharedLists });
      User.hasMany(List, { as: 'SharedLists', through: SharedLists });

      var user1_id;
      return this.sequelize.sync({
        force: true
      }).then(function () {
        return User.create();
      }).then(function (user) {
        user1_id = user.get('id');
        return List.create(
          { OwnerId: user1_id }
        );
      }).then(function (list) {
        return List.find({
          where: Sequelize.and(
            { id: list.get('id') },
            Sequelize.or(
              { OwnerId: user1_id },
              { 'SharedUsers.UserId': user1_id }
            )
          ),
          include: [
            { model: User, as: 'Owner' }, 
            { model: User, as: 'SharedUsers' }
          ]
        });
      }).then(function (list) {
        expect(list).to.be.ok;
      });
    });
  });
});
