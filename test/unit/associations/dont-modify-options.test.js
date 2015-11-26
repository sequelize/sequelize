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
      var self = this;
      var reqValidForeignKey = { foreignKey: { allowNull: false }};
      self.A.belongsTo(self.B, reqValidForeignKey);
      self.A.belongsTo(self.C, reqValidForeignKey);
      expect(self.A.attributes.CId.type).to.deep.equal(self.C.attributes.id.type);
    });
    it('should not be overwritten for belongsToMany', function(){
      var self = this;
      var reqValidForeignKey = { foreignKey: { allowNull: false }, through: 'ABBridge'};
      self.B.belongsToMany(self.A, reqValidForeignKey);
      self.A.belongsTo(self.C, reqValidForeignKey);
      expect(self.A.attributes.CId.type).to.deep.equal(self.C.attributes.id.type);
    });
    it('should not be overwritten for hasOne', function(){
      var self = this;
      var reqValidForeignKey = { foreignKey: { allowNull: false }};
      self.B.hasOne(self.A, reqValidForeignKey);
      self.A.belongsTo(self.C, reqValidForeignKey);
      expect(self.A.attributes.CId.type).to.deep.equal(self.C.attributes.id.type);
    });
    it('should not be overwritten for hasMany', function(){
      var self = this;
      var reqValidForeignKey = { foreignKey: { allowNull: false }};
      self.B.hasMany(self.A, reqValidForeignKey);
      self.A.belongsTo(self.C, reqValidForeignKey);
      expect(self.A.attributes.CId.type).to.deep.equal(self.C.attributes.id.type);
    });
  });
});
