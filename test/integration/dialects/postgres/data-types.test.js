'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../../support');
const dialect = Support.getTestDialect();
const DataTypes = require(__dirname + '/../../../../lib/data-types')[dialect];

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] Data Types', () => {
    describe('DATE', () => {
      // quick test of DATE methods
      it('should validate Infinity/-Infinity as true', () => {
        expect(DataTypes.DATE().validate(Infinity)).to.equal(true);
        expect(DataTypes.DATE().validate(-Infinity)).to.equal(true);
      });

      it('should stringify Infinity/-Infinity to infinity/-infinity', () => {
        expect(DataTypes.DATE().stringify(Infinity)).to.equal('infinity');
        expect(DataTypes.DATE().stringify(-Infinity)).to.equal('-infinity');
      });

      // create dummy user
      it('should be able to create and update records with Infinity/-Infinity', function() {
        this.sequelize.options.typeValidation = true;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          beforeTime: {
            type: DataTypes.DATE,
            defaultValue: -Infinity
          },
          sometime: {
            type: DataTypes.DATE,
            defaultValue: this.sequelize.fn('NOW')
          },
          afterTime: {
            type: DataTypes.DATE,
            defaultValue: Infinity
          }
        });

        return User.sync({
          force: true
        }).then(() => {
          return User.create({
            username: 'bob',
            sometime: Infinity
          }, {
            validate: true
          });
        }).then(user => {
          expect(user.username).to.equal('bob');
          expect(user.beforeTime).to.equal(-Infinity);
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
  });
}
