'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const { DataTypes, sql } = require('@sequelize/core');

const current = Support.sequelize;
const dialect = current.dialect;

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('build', () => {
    it('should populate NOW default values', async () => {
      const Model = current.define(
        'Model',
        {
          created_time: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
          updated_time: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
          },
          ip: {
            type: DataTypes.STRING,
            validate: {
              isIP: true,
            },
          },
          ip2: {
            type: DataTypes.STRING,
            validate: {
              isIP: {
                msg: 'test',
              },
            },
          },
        },
        {
          timestamp: false,
        },
      );
      const instance = Model.build({ ip: '127.0.0.1', ip2: '0.0.0.0' });

      expect(instance.get('created_time')).to.be.an.instanceof(
        Date,
        'created_time should be a date',
      );
      expect(instance.get('updated_time')).to.be.an.instanceof(
        Date,
        'updated_time should be a date',
      );

      await instance.validate();
    });

    it('should populate explicitly undefined UUID primary keys', () => {
      const Model = current.define('Model', {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: sql.uuidV4,
        },
      });
      const instance = Model.build({
        id: undefined,
      });

      expect(instance.get('id')).not.to.be.undefined;
      expect(instance.get('id')).to.be.ok;
    });

    it('should populate undefined columns with default value', () => {
      const Model = current.define('Model', {
        number1: {
          type: DataTypes.INTEGER,
          defaultValue: 1,
        },
        number2: {
          type: DataTypes.INTEGER,
          defaultValue: 2,
        },
      });
      const instance = Model.build({
        number1: undefined,
      });

      expect(instance.get('number1')).not.to.be.undefined;
      expect(instance.get('number1')).to.equal(1);
      expect(instance.get('number2')).not.to.be.undefined;
      expect(instance.get('number2')).to.equal(2);
    });

    if (dialect.supports.dataTypes.JSONB) {
      it('should clone the default values', () => {
        const Model = current.define('Model', {
          data: {
            type: DataTypes.JSONB,
            defaultValue: { foo: 'bar' },
          },
        });
        const instance = Model.build();
        instance.data.foo = 'biz';

        expect(instance.get('data')).to.eql({ foo: 'biz' });
        expect(Model.build().get('data')).to.eql({ foo: 'bar' });
      });
    }
  });
});
