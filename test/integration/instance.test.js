'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('./support'),
  DataTypes = require('../../lib/data-types'),
  dialect = Support.getTestDialect(),
  sinon = require('sinon'),
  isUUID = require('validator').isUUID;

describe(Support.getTestDialectTeaser('Instance'), () => {
  before(function() {
    this.clock = sinon.useFakeTimers();
  });

  afterEach(function() {
    this.clock.reset();
  });

  after(function() {
    this.clock.restore();
  });

  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: { type: DataTypes.STRING },
      uuidv1: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV1 },
      uuidv4: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
      touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      aNumber: { type: DataTypes.INTEGER },
      bNumber: { type: DataTypes.INTEGER },
      aDate: { type: DataTypes.DATE },

      validateTest: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { isInt: true }
      },
      validateCustom: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { len: { msg: 'Length failed.', args: [1, 20] } }
      },

      dateAllowNullTrue: {
        type: DataTypes.DATE,
        allowNull: true
      },

      isSuperUser: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    });

    return this.User.sync({ force: true });
  });

  describe('Escaping', () => {
    it('is done properly for special characters', function() {
      // Ideally we should test more: "\0\n\r\b\t\\\'\"\x1a"
      // But this causes sqlite to fail and exits the entire test suite immediately
      const bio = `${dialect}'"\n`; // Need to add the dialect here so in case of failure I know what DB it failed for

      return this.User.create({ username: bio }).then(u1 => {
        return this.User.findByPk(u1.id).then(u2 => {
          expect(u2.username).to.equal(bio);
        });
      });
    });
  });

  describe('isNewRecord', () => {
    it('returns true for non-saved objects', function() {
      const user = this.User.build({ username: 'user' });
      expect(user.id).to.be.null;
      expect(user.isNewRecord).to.be.ok;
    });

    it('returns false for saved objects', function() {
      return this.User.build({ username: 'user' }).save().then(user => {
        expect(user.isNewRecord).to.not.be.ok;
      });
    });

    it('returns false for created objects', function() {
      return this.User.create({ username: 'user' }).then(user => {
        expect(user.isNewRecord).to.not.be.ok;
      });
    });

    it('returns false for objects found by find method', function() {
      return this.User.create({ username: 'user' }).then(() => {
        return this.User.create({ username: 'user' }).then(user => {
          return this.User.findByPk(user.id).then(user => {
            expect(user.isNewRecord).to.not.be.ok;
          });
        });
      });
    });

    it('returns false for objects found by findAll method', function() {
      const users = [];

      for (let i = 0; i < 10; i++) {
        users[i] = { username: 'user' };
      }

      return this.User.bulkCreate(users).then(() => {
        return this.User.findAll().then(users => {
          users.forEach(u => {
            expect(u.isNewRecord).to.not.be.ok;
          });
        });
      });
    });
  });

  describe('default values', () => {
    describe('uuid', () => {
      it('should store a string in uuidv1 and uuidv4', function() {
        const user = this.User.build({ username: 'a user' });
        expect(user.uuidv1).to.be.a('string');
        expect(user.uuidv4).to.be.a('string');
      });

      it('should store a string of length 36 in uuidv1 and uuidv4', function() {
        const user = this.User.build({ username: 'a user' });
        expect(user.uuidv1).to.have.length(36);
        expect(user.uuidv4).to.have.length(36);
      });

      it('should store a valid uuid in uuidv1 and uuidv4 that conforms to the UUID v1 and v4 specifications', function() {
        const user = this.User.build({ username: 'a user' });
        expect(isUUID(user.uuidv1)).to.be.true;
        expect(isUUID(user.uuidv4, 4)).to.be.true;
      });

      it('should store a valid uuid if the multiple primary key fields used', function() {
        const Person = this.sequelize.define('Person', {
          id1: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV1,
            primaryKey: true
          },
          id2: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV1,
            primaryKey: true
          }
        });

        const person = Person.build({});
        expect(person.id1).to.be.ok;
        expect(person.id1).to.have.length(36);

        expect(person.id2).to.be.ok;
        expect(person.id2).to.have.length(36);
      });
    });
    describe('current date', () => {
      it('should store a date in touchedAt', function() {
        const user = this.User.build({ username: 'a user' });
        expect(user.touchedAt).to.be.instanceof(Date);
      });

      it('should store the current date in touchedAt', function() {
        const clock = sinon.useFakeTimers();
        clock.tick(5000);
        const user = this.User.build({ username: 'a user' });
        clock.restore();
        expect(+user.touchedAt).to.be.equal(5000);
      });
    });

    describe('allowNull date', () => {
      it('should be just "null" and not Date with Invalid Date', function() {
        return this.User.build({ username: 'a user' }).save().then(() => {
          return this.User.findOne({ where: { username: 'a user' } }).then(user => {
            expect(user.dateAllowNullTrue).to.be.null;
          });
        });
      });

      it('should be the same valid date when saving the date', function() {
        const date = new Date();
        return this.User.build({ username: 'a user', dateAllowNullTrue: date }).save().then(() => {
          return this.User.findOne({ where: { username: 'a user' } }).then(user => {
            expect(user.dateAllowNullTrue.toString()).to.equal(date.toString());
          });
        });
      });
    });

    describe('super user boolean', () => {
      it('should default to false', function() {
        return this.User.build({
          username: 'a user'
        })
          .save()
          .then(() => {
            return this.User.findOne({
              where: {
                username: 'a user'
              }
            })
              .then(user => {
                expect(user.isSuperUser).to.be.false;
              });
          });
      });

      it('should override default when given truthy boolean', function() {
        return this.User.build({
          username: 'a user',
          isSuperUser: true
        })
          .save()
          .then(() => {
            return this.User.findOne({
              where: {
                username: 'a user'
              }
            })
              .then(user => {
                expect(user.isSuperUser).to.be.true;
              });
          });
      });

      it('should override default when given truthy boolean-string ("true")', function() {
        return this.User.build({
          username: 'a user',
          isSuperUser: 'true'
        })
          .save()
          .then(() => {
            return this.User.findOne({
              where: {
                username: 'a user'
              }
            })
              .then(user => {
                expect(user.isSuperUser).to.be.true;
              });
          });
      });

      it('should override default when given truthy boolean-int (1)', function() {
        return this.User.build({
          username: 'a user',
          isSuperUser: 1
        })
          .save()
          .then(() => {
            return this.User.findOne({
              where: {
                username: 'a user'
              }
            })
              .then(user => {
                expect(user.isSuperUser).to.be.true;
              });
          });
      });

      it('should throw error when given value of incorrect type', function() {
        let callCount = 0;

        return this.User.build({
          username: 'a user',
          isSuperUser: 'INCORRECT_VALUE_TYPE'
        })
          .save()
          .then(() => {
            callCount += 1;
          })
          .catch(err => {
            expect(callCount).to.equal(0);
            expect(err).to.exist;
            expect(err.message).to.exist;
          });
      });
    });
  });

  describe('complete', () => {
    it('gets triggered if an error occurs', function() {
      return this.User.findOne({ where: ['asdasdasd'] }).catch(err => {
        expect(err).to.exist;
        expect(err.message).to.exist;
      });
    });

    it('gets triggered if everything was ok', function() {
      return this.User.count().then(result => {
        expect(result).to.exist;
      });
    });
  });

  describe('findAll', () => {
    beforeEach(function() {
      this.ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: { type: DataTypes.STRING }
      }, { paranoid: true });

      this.ParanoidUser.hasOne(this.ParanoidUser);
      return this.ParanoidUser.sync({ force: true });
    });

    it('sql should have paranoid condition', function() {
      return this.ParanoidUser.create({ username: 'cuss' })
        .then(() => {
          return this.ParanoidUser.findAll();
        })
        .then(users => {
          expect(users).to.have.length(1);
          return users[0].destroy();
        })
        .then(() => {
          return this.ParanoidUser.findAll();
        })
        .then(users => {
          expect(users).to.have.length(0);
        });
    });

    it('sequelize.and as where should include paranoid condition', function() {
      return this.ParanoidUser.create({ username: 'cuss' })
        .then(() => {
          return this.ParanoidUser.findAll({
            where: this.sequelize.and({
              username: 'cuss'
            })
          });
        })
        .then(users => {
          expect(users).to.have.length(1);
          return users[0].destroy();
        })
        .then(() => {
          return this.ParanoidUser.findAll({
            where: this.sequelize.and({
              username: 'cuss'
            })
          });
        })
        .then(users => {
          expect(users).to.have.length(0);
        });
    });

    it('sequelize.or as where should include paranoid condition', function() {
      return this.ParanoidUser.create({ username: 'cuss' })
        .then(() => {
          return this.ParanoidUser.findAll({
            where: this.sequelize.or({
              username: 'cuss'
            })
          });
        })
        .then(users => {
          expect(users).to.have.length(1);
          return users[0].destroy();
        })
        .then(() => {
          return this.ParanoidUser.findAll({
            where: this.sequelize.or({
              username: 'cuss'
            })
          });
        })
        .then(users => {
          expect(users).to.have.length(0);
        });
    });

    it('escapes a single single quotes properly in where clauses', function() {
      return this.User
        .create({ username: "user'name" })
        .then(() => {
          return this.User.findAll({
            where: { username: "user'name" }
          }).then(users => {
            expect(users.length).to.equal(1);
            expect(users[0].username).to.equal("user'name");
          });
        });
    });

    it('escapes two single quotes properly in where clauses', function() {
      return this.User
        .create({ username: "user''name" })
        .then(() => {
          return this.User.findAll({
            where: { username: "user''name" }
          }).then(users => {
            expect(users.length).to.equal(1);
            expect(users[0].username).to.equal("user''name");
          });
        });
    });

    it('returns the timestamps if no attributes have been specified', function() {
      return this.User.create({ username: 'fnord' }).then(() => {
        return this.User.findAll().then(users => {
          expect(users[0].createdAt).to.exist;
        });
      });
    });

    it('does not return the timestamps if the username attribute has been specified', function() {
      return this.User.create({ username: 'fnord' }).then(() => {
        return this.User.findAll({ attributes: ['username'] }).then(users => {
          expect(users[0].createdAt).not.to.exist;
          expect(users[0].username).to.exist;
        });
      });
    });

    it('creates the deletedAt property, when defining paranoid as true', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          expect(users[0].deletedAt).to.be.null;
        });
      });
    });

    it('destroys a record with a primary key of something other than id', function() {
      const UserDestroy = this.sequelize.define('UserDestroy', {
        newId: {
          type: DataTypes.STRING,
          primaryKey: true
        },
        email: DataTypes.STRING
      });

      return UserDestroy.sync().then(() => {
        return UserDestroy.create({ newId: '123ABC', email: 'hello' }).then(() => {
          return UserDestroy.findOne({ where: { email: 'hello' } }).then(user => {
            return user.destroy();
          });
        });
      });
    });

    it('sets deletedAt property to a specific date when deleting an instance', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          return users[0].destroy().then(() => {
            expect(users[0].deletedAt.getMonth).to.exist;

            return users[0].reload({ paranoid: false }).then(user => {
              expect(user.deletedAt.getMonth).to.exist;
            });
          });
        });
      });
    });

    it('keeps the deletedAt-attribute with value null, when running update', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          return users[0].update({ username: 'newFnord' }).then(user => {
            expect(user.deletedAt).not.to.exist;
          });
        });
      });
    });

    it('keeps the deletedAt-attribute with value null, when updating associations', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          return this.ParanoidUser.create({ username: 'linkedFnord' }).then(linkedUser => {
            return users[0].setParanoidUser(linkedUser).then(user => {
              expect(user.deletedAt).not.to.exist;
            });
          });
        });
      });
    });

    it('can reuse query option objects', function() {
      return this.User.create({ username: 'fnord' }).then(() => {
        const query = { where: { username: 'fnord' } };
        return this.User.findAll(query).then(users => {
          expect(users[0].username).to.equal('fnord');
          return this.User.findAll(query).then(users => {
            expect(users[0].username).to.equal('fnord');
          });
        });
      });
    });
  });

  describe('findOne', () => {
    it('can reuse query option objects', function() {
      return this.User.create({ username: 'fnord' }).then(() => {
        const query = { where: { username: 'fnord' } };
        return this.User.findOne(query).then(user => {
          expect(user.username).to.equal('fnord');
          return this.User.findOne(query).then(user => {
            expect(user.username).to.equal('fnord');
          });
        });
      });
    });
    it('returns null for null, undefined, and unset boolean values', function() {
      const Setting = this.sequelize.define('SettingHelper', {
        setting_key: DataTypes.STRING,
        bool_value: { type: DataTypes.BOOLEAN, allowNull: true },
        bool_value2: { type: DataTypes.BOOLEAN, allowNull: true },
        bool_value3: { type: DataTypes.BOOLEAN, allowNull: true }
      }, { timestamps: false, logging: false });

      return Setting.sync({ force: true }).then(() => {
        return Setting.create({ setting_key: 'test', bool_value: null, bool_value2: undefined }).then(() => {
          return Setting.findOne({ where: { setting_key: 'test' } }).then(setting => {
            expect(setting.bool_value).to.equal(null);
            expect(setting.bool_value2).to.equal(null);
            expect(setting.bool_value3).to.equal(null);
          });
        });
      });
    });
  });

  describe('equals', () => {
    it('can compare records with Date field', function() {
      return this.User.create({ username: 'fnord' }).then(user1 => {
        return this.User.findOne({ where: { username: 'fnord' } }).then(user2 => {
          expect(user1.equals(user2)).to.be.true;
        });
      });
    });

    it('does not compare the existence of associations', function() {
      this.UserAssociationEqual = this.sequelize.define('UserAssociationEquals', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER
      }, { timestamps: false });

      this.ProjectAssociationEqual = this.sequelize.define('ProjectAssocationEquals', {
        title: DataTypes.STRING,
        overdue_days: DataTypes.INTEGER
      }, { timestamps: false });

      this.UserAssociationEqual.hasMany(this.ProjectAssociationEqual, { as: 'Projects', foreignKey: 'userId' });
      this.ProjectAssociationEqual.belongsTo(this.UserAssociationEqual, { as: 'Users', foreignKey: 'userId' });

      return this.UserAssociationEqual.sync({ force: true }).then(() => {
        return this.ProjectAssociationEqual.sync({ force: true }).then(() => {
          return this.UserAssociationEqual.create({ username: 'jimhalpert' }).then(user1 => {
            return this.ProjectAssociationEqual.create({ title: 'A Cool Project' }).then(project1 => {
              return user1.setProjects([project1]).then(() => {
                return this.UserAssociationEqual.findOne({ where: { username: 'jimhalpert' }, include: [{ model: this.ProjectAssociationEqual, as: 'Projects' }] }).then(user2 => {
                  return this.UserAssociationEqual.create({ username: 'pambeesly' }).then(user3 => {
                    expect(user1.get('Projects')).to.not.exist;
                    expect(user2.get('Projects')).to.exist;
                    expect(user1.equals(user2)).to.be.true;
                    expect(user2.equals(user1)).to.be.true;
                    expect(user1.equals(user3)).to.not.be.true;
                    expect(user3.equals(user1)).to.not.be.true;
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('values', () => {
    it('returns all values', function() {
      const User = this.sequelize.define('UserHelper', {
        username: DataTypes.STRING
      }, { timestamps: false, logging: false });

      return User.sync().then(() => {
        const user = User.build({ username: 'foo' });
        expect(user.get({ plain: true })).to.deep.equal({ username: 'foo', id: null });
      });
    });
  });

  describe('isSoftDeleted', () => {
    beforeEach(function() {
      this.ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: { type: DataTypes.STRING }
      }, { paranoid: true });

      return this.ParanoidUser.sync({ force: true });
    });

    it('should return false when model is just created', function() {
      return this.ParanoidUser.create({ username: 'foo' }).then(user => {
        expect(user.isSoftDeleted()).to.be.false;
      });
    });

    it('returns false if user is not soft deleted', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          expect(users[0].isSoftDeleted()).to.be.false;
        });
      });
    });

    it('returns true if user is soft deleted', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          return users[0].destroy().then(() => {
            expect(users[0].isSoftDeleted()).to.be.true;

            return users[0].reload({ paranoid: false }).then(user => {
              expect(user.isSoftDeleted()).to.be.true;
            });
          });
        });
      });
    });

    it('works with custom `deletedAt` field name', function() {
      this.ParanoidUserWithCustomDeletedAt = this.sequelize.define('ParanoidUserWithCustomDeletedAt', {
        username: { type: DataTypes.STRING }
      }, {
        deletedAt: 'deletedAtThisTime',
        paranoid: true
      });

      this.ParanoidUserWithCustomDeletedAt.hasOne(this.ParanoidUser);

      return this.ParanoidUserWithCustomDeletedAt.sync({ force: true }).then(() => {
        return this.ParanoidUserWithCustomDeletedAt.create({ username: 'fnord' }).then(() => {
          return this.ParanoidUserWithCustomDeletedAt.findAll().then(users => {
            expect(users[0].isSoftDeleted()).to.be.false;

            return users[0].destroy().then(() => {
              expect(users[0].isSoftDeleted()).to.be.true;

              return users[0].reload({ paranoid: false }).then(user => {
                expect(user.isSoftDeleted()).to.be.true;
              });
            });
          });
        });
      });
    });
  });

  describe('restore', () => {
    it('returns an error if the model is not paranoid', function() {
      return this.User.create({ username: 'Peter', secretValue: '42' }).then(user => {
        expect(() => {user.restore();}).to.throw(Error, 'Model is not paranoid');
      });
    });

    it('restores a previously deleted model', function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
          username: DataTypes.STRING,
          secretValue: DataTypes.STRING,
          data: DataTypes.STRING,
          intVal: { type: DataTypes.INTEGER, defaultValue: 1 }
        }, {
          paranoid: true
        }),
        data = [{ username: 'Peter', secretValue: '42' },
          { username: 'Paul', secretValue: '43' },
          { username: 'Bob', secretValue: '44' }];

      return ParanoidUser.sync({ force: true }).then(() => {
        return ParanoidUser.bulkCreate(data);
      }).then(() => {
        return ParanoidUser.findOne({ where: { secretValue: '42' } });
      }).then(user => {
        return user.destroy().then(() => {
          return user.restore();
        });
      }).then(() => {
        return ParanoidUser.findOne({ where: { secretValue: '42' } });
      }).then(user => {
        expect(user).to.be.ok;
        expect(user.username).to.equal('Peter');
      });
    });
  });
});
