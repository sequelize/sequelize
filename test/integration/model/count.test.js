'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      age: DataTypes.INTEGER
    });
    this.Project = this.sequelize.define('Project', {
      name: DataTypes.STRING
    });

    this.User.hasMany(this.Project);
    this.Project.belongsTo(this.User);

    return this.sequelize.sync({force: true});
  });

  describe('count', () => {
    beforeEach(function() {
      const self = this;
      return this.User.bulkCreate([
        {username: 'boo'},
        {username: 'boo2'}
      ]).then(() => {
        return self.User.findOne();
      }).then(user => {
        return user.createProject({
          name: 'project1'
        });
      });
    });

    it('should count rows', function() {
      return expect(this.User.count()).to.eventually.equal(2);
    });

    it('should support include', function() {
      return expect(this.User.count({
        include: [{
          model: this.Project,
          where: {
            name: 'project1'
          }
        }]
      })).to.eventually.equal(1);
    });

    it('should return attributes', function() {
      return this.User.create({
        username: 'valak',
        createdAt: (new Date()).setFullYear(2015)
      })
        .then(() =>
          this.User.count({
            attributes: ['createdAt'],
            group: ['createdAt']
          })
        )
        .then(users => {
          expect(users.length).to.be.eql(2);

          // have attributes
          expect(users[0].createdAt).to.exist;
          expect(users[1].createdAt).to.exist;
        });
    });

    it('should not return NaN', function() {
      return this.sequelize.sync({ force: true })
        .then(() =>
          this.User.bulkCreate([
            { username: 'valak', age: 10},
            { username: 'conjuring', age: 20},
            { username: 'scary', age: 10}
          ])
        )
        .then(() =>
          this.User.count({
            where: { age: 10 },
            group: ['age'],
            order: ['age']
          })
        )
        .then(result => {
          expect(parseInt(result[0].count)).to.be.eql(2);
          return this.User.count({
            where: { username: 'fire' }
          });
        })
        .then(count => {
          expect(count).to.be.eql(0);
          return this.User.count({
            where: { username: 'fire' },
            group: 'age'
          });
        })
        .then(count => {
          expect(count).to.be.eql([]);
        });
    });

    it('should be able to specify column for COUNT()', function() {
      return this.sequelize.sync({ force: true })
        .then(() =>
          this.User.bulkCreate([
            { username: 'ember', age: 10},
            { username: 'angular', age: 20},
            { username: 'mithril', age: 10}
          ])
        )
        .then(() =>
          this.User.count({
            col: 'username'
          })
        )
        .then(count => {
          expect(parseInt(count)).to.be.eql(3);
          return this.User.count({
            col: 'age',
            distinct: true
          });
        })
        .then(count => {
          expect(parseInt(count)).to.be.eql(2);
        });
    });

    it('should be able to use where clause on included models', function() {
      const queryObject = {
        col: 'username',
        include: [this.Project],
        where: {
          '$Projects.name$': 'project1'
        }
      };
      return this.User.count(queryObject).then(count => {
        expect(parseInt(count)).to.be.eql(1);
        queryObject.where['$Projects.name$'] = 'project2';
        return this.User.count(queryObject);
      }).then(count => {
        expect(parseInt(count)).to.be.eql(0);
      });
    });

    it('should be able to specify column for COUNT() with includes', function() {
      return this.sequelize.sync({ force: true }).then(() =>
        this.User.bulkCreate([
          { username: 'ember', age: 10},
          { username: 'angular', age: 20},
          { username: 'mithril', age: 10}
        ])
      ).then(() =>
        this.User.count({
          col: 'username',
          distinct: true,
          include: [this.Project]
        })
      ).then(count => {
        expect(parseInt(count)).to.be.eql(3);
        return this.User.count({
          col: 'age',
          distinct: true,
          include: [this.Project]
        });
      }).then(count => expect(parseInt(count)).to.be.eql(2));
    });

  });
});
