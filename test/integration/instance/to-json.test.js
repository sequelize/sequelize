'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types');

describe.only(Support.getTestDialectTeaser('Instance'), () => {
  describe('toJSON', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: { type: DataTypes.STRING },
        age: DataTypes.INTEGER,
        level: { type: DataTypes.INTEGER },
        bigLevel: { type: DataTypes.BIGINT },
        isUser: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        isAdmin: { type: DataTypes.BOOLEAN }
      }, {
        timestamps: false
      });

      this.Project = this.sequelize.define('NiceProject', { title: DataTypes.STRING }, { timestamps: false });

      this.User.hasMany(this.Project, { as: 'Projects', foreignKey: 'lovelyUserId' });
      this.Project.belongsTo(this.User, { as: 'LovelyUser', foreignKey: 'lovelyUserId' });

      return this.User.sync({ force: true }).then(() => {
        return this.Project.sync({ force: true });
      });
    });

    it("dont return instance that isn't defined", function() {
      const self = this;
      return self.Project.create({ lovelyUserId: null })
        .then(project => {
          return self.Project.findOne({
            where: {
              id: project.id
            },
            include: [
              { model: self.User, as: 'LovelyUser' }
            ]
          });
        })
        .then(project => {
          const json = project.toJSON();
          expect(json.LovelyUser).to.be.equal(null);
        });
    });

    it("dont return instances that aren't defined", function() {
      const self = this;
      return self.User.create({ username: 'cuss' })
        .then(user => {
          return self.User.findOne({
            where: {
              id: user.id
            },
            include: [
              { model: self.Project, as: 'Projects' }
            ]
          });
        })
        .then(user => {
          expect(user.Projects).to.be.instanceof(Array);
          expect(user.Projects).to.be.length(0);
        });
    });

    describe('build', () => {
      it('returns an object containing all values', function() {
        const user = this.User.build({
          username: 'Adam',
          age: 22,
          level: -1,
          bigLevel: '90071992547409911',
          isUser: false,
          isAdmin: true
        });

        expect(user.toJSON()).to.deep.equal({
          id: null,
          username: 'Adam',
          age: 22,
          level: -1,
          bigLevel: '90071992547409911',
          isUser: false,
          isAdmin: true
        });
      });

      it('returns a response that can be stringified', function() {
        const user = this.User.build({
          username: 'test.user',
          age: 99,
          isAdmin: true,
          isUser: false
        });
        expect(JSON.stringify(user)).to.deep.equal('{"id":null,"username":"test.user","age":99,"isAdmin":true,"isUser":false}');
      });

      it('returns a response that can be stringified and then parsed', function() {
        const user = this.User.build({ username: 'test.user', age: 99, isAdmin: true });
        expect(JSON.parse(JSON.stringify(user))).to.deep.equal({ username: 'test.user', age: 99, isAdmin: true, isUser: false, id: null });
      });
    });

    describe('create', () => {
      it('returns an object containing all values', function() {
        return this.User.create({
          username: 'Adam',
          age: 22,
          level: -1,
          bigLevel: '90071992547409911',
          isUser: false,
          isAdmin: true
        }).then(user => {
          expect(user.toJSON()).to.deep.equal({
            id: user.get('id'),
            username: 'Adam',
            age: 22,
            level: -1,
            bigLevel: '90071992547409911',
            isUser: false,
            isAdmin: true
          });
        });
      });

      it('returns a response that can be stringified', function() {
        return this.User.create({
          username: 'test.user',
          age: 99,
          isAdmin: true,
          isUser: false
        }).then(user => {
          expect(JSON.stringify(user)).to.deep.equal(`{"id":${user.get('id')},"username":"test.user","age":99,"isAdmin":true,"isUser":false,"level":null,"bigLevel":null}`);
        });
      });

      it('returns a response that can be stringified and then parsed', function() {
        return this.User.create({
          username: 'test.user',
          age: 99,
          isAdmin: true
        }).then(user => {
          expect(JSON.parse(JSON.stringify(user))).to.deep.equal({
            id: user.get('id'),
            username: 'test.user',
            age: 99,
            isAdmin: true,
            isUser: false,
            bigLevel: null,
            level: null
          });
        });
      });
    });

    it('includes the eagerly loaded associations', function() {
      const self = this;
      return this.User.create({ username: 'fnord', age: 1, isAdmin: true }).then(user => {
        return self.Project.create({ title: 'fnord' }).then(project => {
          return user.setProjects([project]).then(() => {
            return self.User.findAll({include: [{ model: self.Project, as: 'Projects' }]}).then(users => {
              const _user = users[0];

              expect(_user.Projects).to.exist;
              expect(JSON.parse(JSON.stringify(_user)).Projects).to.exist;

              return self.Project.findAll({include: [{ model: self.User, as: 'LovelyUser' }]}).then(projects => {
                const _project = projects[0];

                expect(_project.LovelyUser).to.exist;
                expect(JSON.parse(JSON.stringify(_project)).LovelyUser).to.exist;
              });
            });
          });
        });
      });
    });
  });
});
