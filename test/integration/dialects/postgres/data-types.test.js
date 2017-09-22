'use strict';

const chai = require('chai');
const expect = chai.expect;
// const sinon = require('sinon');
const Support = require(__dirname + '/../../support');
const dialect = Support.getTestDialect();
const DataTypes = require(__dirname + '/../../../../lib/data-types');

if (dialect === 'postgres') {
  describe('[POSTGRES Specific] Data Types', () => {
    describe('DATE', () => {
      // quick test of DATE methods
      it('should validate Infinity/-Infinity as true', () => {
        expect(DataTypes[dialect].DATE().validate(Infinity)).to.equal(true);
        expect(DataTypes[dialect].DATE().validate(-Infinity)).to.equal(true);
      });

      it('should stringify Infinity/-Infinity to infinity/-infinity', () => {
        expect(DataTypes[dialect].DATE().stringify(Infinity)).to.equal('infinity');
        expect(DataTypes[dialect].DATE().stringify(-Infinity)).to.equal('-infinity');
      });
    });

    describe('DATE SQL', () => {
      // create dummy user
      it('should be able to create and update records with Infinity/-Infinity', function() {
        this.sequelize.options.typeValidation = true;

        const User = this.sequelize.define('User', {
          username: this.sequelize.Sequelize.STRING,
          beforeTime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: -Infinity
          },
          sometime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: this.sequelize.fn('NOW')
          },
          anotherTime: {
            type: this.sequelize.Sequelize.DATE
          },
          afterTime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: Infinity
          }
        }, {
          timestamps: true
        });

        return User.sync({
          force: true
        }).then(() => {
          return User.create({
            username: 'bob',
            anotherTime: Infinity
          }, {
            validate: true
          });
        }).then(user => {
          expect(user.username).to.equal('bob');
          expect(user.beforeTime).to.equal(-Infinity);
          expect(user.sometime).to.not.equal(Infinity);
          expect(user.anotherTime).to.equal(Infinity);
          expect(user.afterTime).to.equal(Infinity);

          return user.update({
            sometime: Infinity
          });
        }).then(user => {
          expect(user.sometime).to.equal(Infinity);

          return user.update({
            sometime: this.sequelize.fn('NOW')
          });
        }).then(user => {
          expect(user.sometime).to.not.equal(Infinity);

          // find
          return User.findAll();
        }).then(users => {
          expect(users[0].beforeTime).to.equal(-Infinity);
          expect(users[0].sometime).to.not.equal(Infinity);
          expect(users[0].afterTime).to.equal(Infinity);
        });
      });

    });

    // describe('when nothing changed', () => {
    //   beforeEach(function() {
    //     this.clock = sinon.useFakeTimers();
    //   });

    //   afterEach(function() {
    //     this.clock.restore();
    //   });

    //   it('does not update timestamps', function() {
    //     this.sequelize.options.typeValidation = true;

    //     const User = this.sequelize.define('User', {
    //       username: this.sequelize.Sequelize.STRING
    //     }, {
    //       timestamps: true
    //     });

    //     return User.sync({
    //       force: true
    //     }).then(() => {
    //       return User.create({ username: 'John' }).then(() => {
    //         return User.findOne({ where: { username: 'John' } }).then(user => {
    //           const updatedAt = user.updatedAt;
    //           this.clock.tick(2000);
    //           return user.save().then(newlySavedUser => {
    //             expect(newlySavedUser.updatedAt).to.equalTime(updatedAt);
    //             return User.findOne({ where: { username: 'John' } }).then(newlySavedUser => {
    //               expect(newlySavedUser.updatedAt).to.equalTime(updatedAt);
    //             });
    //           });
    //         });
    //       });
    //     });

    //   });

    // describe('when nothing changed', () => {
    //   it('doesn\'t set timestamps', function() {
    //     const User = this.sequelize.define('User', {
    //       identifier: {type: DataTypes.STRING, primaryKey: true}
    //     });

    //     const user = User.build({}, {
    //       isNewRecord: false
    //     });

    //     user.set({
    //       createdAt: new Date(2000, 1, 1),
    //       updatedAt: new Date(2000, 1, 1)
    //     });

    //     expect(user.get('createdAt')).not.to.be.ok;
    //     expect(user.get('updatedAt')).not.to.be.ok;
    //   });

    //   it('doesn\'t set underscored timestamps', function() {
    //     const User = this.sequelize.define('User', {
    //       identifier: {type: DataTypes.STRING, primaryKey: true}
    //     }, {
    //       underscored: true
    //     });

    //     const user = User.build({}, {
    //       isNewRecord: false
    //     });

    //     user.set({
    //       created_at: new Date(2000, 1, 1),
    //       updated_at: new Date(2000, 1, 1)
    //     });

    //     expect(user.get('created_at')).not.to.be.ok;
    //     expect(user.get('updated_at')).not.to.be.ok;
    //   });

    // });

    // describe('on update', () => {
    //   beforeEach(function() {
    //     this.clock = sinon.useFakeTimers();
    //   });

    //   afterEach(function() {
    //     this.clock.restore();
    //   });

    //   it('doesn\'t update primary keys or timestamps', function() {
    //     const User = this.sequelize.define('User', {
    //       name: DataTypes.STRING,
    //       bio: DataTypes.TEXT,
    //       identifier: {type: DataTypes.STRING, primaryKey: true}
    //     });

    //     return User.sync({ force: true }).bind(this).then(() => {
    //       return User.create({
    //         name: 'snafu',
    //         identifier: 'identifier'
    //       });
    //     }).then(function(user) {
    //       const oldCreatedAt = user.createdAt,
    //         oldUpdatedAt = user.updatedAt,
    //         oldIdentifier = user.identifier;

    //       this.clock.tick(1000);
    //       return user.update({
    //         name: 'foobar',
    //         createdAt: new Date(2000, 1, 1),
    //         identifier: 'another identifier'
    //       }).then(user => {
    //         expect(new Date(user.createdAt)).to.equalDate(new Date(oldCreatedAt));
    //         expect(new Date(user.updatedAt)).to.not.equalTime(new Date(oldUpdatedAt));
    //         expect(user.identifier).to.equal(oldIdentifier);
    //       });
    //     });
    //   });
    // });

  });
}
