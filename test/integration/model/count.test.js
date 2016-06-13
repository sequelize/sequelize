'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), function() {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING
    });
    this.Project = this.sequelize.define('Project', {
      name: DataTypes.STRING
    });

    this.User.hasMany(this.Project);
    this.Project.belongsTo(this.User);

    return this.sequelize.sync({force: true});
  });

  describe('count', function() {
    beforeEach(function () {
      var self = this;
      return this.User.bulkCreate([
        {username: 'boo'},
        {username: 'boo2'}
      ]).then(function () {
        return self.User.findOne();
      }).then(function (user) {
        return user.createProject({
          name: 'project1'
        });
      });
    });

    it('should count rows', function () {
      return expect(this.User.count()).to.eventually.equal(2);
    });

    it('should support include', function () {
      return expect(this.User.count({
        include: [{
          model: this.Project,
          where: {
            name: 'project1'
          }
        }]
      })).to.eventually.equal(1);
    });

    it('should return attributes', function () {
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
      .then((users) => {
        expect(users.length).to.be.eql(2);

        // correct count
        expect(users[0].count).to.be.eql('1');
        expect(users[1].count).to.be.eql('2');

        // have attributes
        expect(users[0].createdAt).to.exist;
        expect(users[1].createdAt).to.exist;
      });
    });

  });
});
