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
          },
          ip: {
            type: DataTypes.STRING,
            validate: {
              isIP: true
            }
          },
          ip2: {
            type: DataTypes.STRING,
            validate: {
              isIP: {
                msg: 'test'
              }
            }
          }
        }, {
          timestamp: false
        })
        , instance;

      instance = Model.build({ip: '127.0.0.1', ip2: '0.0.0.0'});

      expect(instance.get('created_time')).to.be.ok;
      expect(instance.get('created_time')).to.be.an.instanceof(Date);

      expect(instance.get('updated_time')).to.be.ok;
      expect(instance.get('updated_time')).to.be.an.instanceof(Date);

      return instance.validate().then(function(err) {
        expect(err).to.be.equal(null);
      });
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

    it('should populate undefined columns with default value', function () {
      var Model = current.define('Model', {
        number1: {
          type: DataTypes.INTEGER,
          defaultValue: 1
        },
        number2: {
          type: DataTypes.INTEGER,
          defaultValue: 2
        }
      })
        , instance;

      instance = Model.build({
        number1: undefined
      });

      expect(instance.get('number1')).not.to.be.undefined;
      expect(instance.get('number1')).to.equal(1);
      expect(instance.get('number2')).not.to.be.undefined;
      expect(instance.get('number2')).to.equal(2);
    });

    it('should clone the default values', function () {
      var Model = current.define('Model', {
        data: {
          type: DataTypes.JSONB,
          defaultValue: { foo: 'bar' }
        }
      })
        , instance;

      instance = Model.build();
      instance.data.foo = 'biz';

      expect(instance.get('data')).to.eql({ foo: 'biz' });
      expect(Model.build().get('data')).to.eql({ foo: 'bar' });
    });
  });
});
