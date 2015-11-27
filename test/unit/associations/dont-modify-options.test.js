'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Sequelize = require('../../../index');

describe(Support.getTestDialectTeaser('associations'), function() {
  describe('Test options.foreignKey', function() {
    beforeEach(function() {

      this.A = this.sequelize.define('A', {
        id: {
          type: DataTypes.CHAR(20),
          primaryKey: true
        }
      });
      this.B = this.sequelize.define('B', {
        id: {
          type: Sequelize.CHAR(20),
          primaryKey: true
        }
      });
      this.C = this.sequelize.define('C', {});
    });

    it('should not be overwritten for belongsTo', function(){
      var reqValidForeignKey = { foreignKey: { allowNull: false }};
      this.A.belongsTo(this.B, reqValidForeignKey);
      this.A.belongsTo(this.C, reqValidForeignKey);
      expect(this.A.attributes.CId.type).to.deep.equal(this.C.attributes.id.type);
    });
    it('should not be overwritten for belongsToMany', function(){
      var reqValidForeignKey = { foreignKey: { allowNull: false }, through: 'ABBridge'};
      this.B.belongsToMany(this.A, reqValidForeignKey);
      this.A.belongsTo(this.C, reqValidForeignKey);
      expect(this.A.attributes.CId.type).to.deep.equal(this.C.attributes.id.type);
    });
    it('should not be overwritten for hasOne', function(){
      var reqValidForeignKey = { foreignKey: { allowNull: false }};
      this.B.hasOne(this.A, reqValidForeignKey);
      this.A.belongsTo(this.C, reqValidForeignKey);
      expect(this.A.attributes.CId.type).to.deep.equal(this.C.attributes.id.type);
    });
    it('should not be overwritten for hasMany', function(){
      var reqValidForeignKey = { foreignKey: { allowNull: false }};
      this.B.hasMany(this.A, reqValidForeignKey);
      this.A.belongsTo(this.C, reqValidForeignKey);
      expect(this.A.attributes.CId.type).to.deep.equal(this.C.attributes.id.type);
    });
  });
});
