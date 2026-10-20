import type { InferAttributes, Model } from '@sequelize/core';
import { DataTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('Model.build', () => {
  it('should populate NOW default values', async () => {
    const Model = sequelize.define(
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
        timestamps: false,
      },
    );
    const instance = Model.build({ ip: '127.0.0.1', ip2: '0.0.0.0' });

    expect(instance.get('created_time')).to.be.an.instanceof(Date, 'created_time should be a date');
    expect(instance.get('updated_time')).to.be.an.instanceof(Date, 'updated_time should be a date');

    await instance.validate();
  });

  it('should populate explicitly undefined UUID primary keys', () => {
    const Model = sequelize.define('Model', {
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
    const Model = sequelize.define('Model', {
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
      interface TModel extends Model<InferAttributes<TModel>> {
        data: { foo: string };
      }

      const Model = sequelize.define<TModel>('Model', {
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
