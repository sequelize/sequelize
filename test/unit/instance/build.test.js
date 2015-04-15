'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), function() {
  describe('build', function () {
    it('should popuplate NOW default values', function () {
      var Model = current.define('Model', {
          created_time: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW
          },
          updated_time: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW
          }
        })
        , instance;

      instance = Model.build({});

      expect(instance.get('created_time')).to.be.ok;
      expect(instance.get('created_time')).to.be.an.instanceof(Date);

      expect(instance.get('updated_time')).to.be.ok;
      expect(instance.get('updated_time')).to.be.an.instanceof(Date);
    });

    it('should popuplate explicitely undefined UUID primary keys', function () {
      var Model = current.define('Model', {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        }
      })
        , instance;

      instance = Model.build({
        id: undefined
      });

      expect(instance.get('id')).not.to.be.undefined;
      expect(instance.get('id')).to.be.ok;
    });
  });
});