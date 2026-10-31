import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { beforeEach2, sequelize } from '../../support';

describe('Model options.underscored', () => {
  const vars = beforeEach2(() => {
    const N = sequelize.define(
      'N',
      {
        id: {
          type: DataTypes.STRING(10),
          primaryKey: true,
          field: 'n_id',
        },
      },
      {
        underscored: true,
      },
    );

    const M = sequelize.define(
      'M',
      {
        id: {
          type: DataTypes.STRING(20),
          primaryKey: true,
          field: 'm_id',
        },
      },
      {
        underscored: true,
      },
    );

    return { N, M };
  });

  it('should properly set field when defining', () => {
    expect(vars.N.getAttributes().id.field).to.equal('n_id');
    expect(vars.M.getAttributes().id.field).to.equal('m_id');
  });

  it('hasOne does not override already defined field', () => {
    vars.N.modelDefinition.rawAttributes.mId = {
      type: DataTypes.STRING(20),
      field: 'n_m_id',
    };
    vars.N.modelDefinition.refreshAttributes();

    expect(vars.N.getAttributes().mId.field).to.equal('n_m_id');
    vars.M.hasOne(vars.N, { foreignKey: 'mId' });
    expect(vars.N.getAttributes().mId.field).to.equal('n_m_id');
  });

  it('belongsTo does not override already defined field', () => {
    vars.N.modelDefinition.rawAttributes.mId = {
      type: DataTypes.STRING(20),
      field: 'n_m_id',
    };
    vars.N.modelDefinition.refreshAttributes();

    expect(vars.N.getAttributes().mId.field).to.equal('n_m_id');
    vars.N.belongsTo(vars.M, { foreignKey: 'mId' });
    expect(vars.N.getAttributes().mId.field).to.equal('n_m_id');
  });

  it('hasOne/belongsTo does not override already defined field', () => {
    vars.N.modelDefinition.rawAttributes.mId = {
      type: DataTypes.STRING(20),
      field: 'n_m_id',
    };
    vars.N.modelDefinition.refreshAttributes();

    expect(vars.N.getAttributes().mId.field).to.equal('n_m_id');
    vars.N.belongsTo(vars.M, { foreignKey: 'mId' });
    vars.M.hasOne(vars.N, { foreignKey: 'mId' });
    expect(vars.N.getAttributes().mId.field).to.equal('n_m_id');
  });

  it('hasMany does not override already defined field', () => {
    vars.M.modelDefinition.rawAttributes.nId = {
      type: DataTypes.STRING(20),
      field: 'nana_id',
    };
    vars.M.modelDefinition.refreshAttributes();

    expect(vars.M.getAttributes().nId.field).to.equal('nana_id');

    vars.N.hasMany(vars.M, { foreignKey: 'nId' });
    vars.M.belongsTo(vars.N, { foreignKey: 'nId' });

    expect(vars.M.getAttributes().nId.field).to.equal('nana_id');
  });

  it('belongsToMany does not override already defined field', () => {
    const NM = sequelize.define(
      'NM',
      {
        n_id: {
          type: DataTypes.STRING(10),
          field: 'nana_id',
        },
        m_id: {
          type: DataTypes.STRING(20),
          field: 'mama_id',
        },
      },
      {
        underscored: true,
      },
    );

    vars.N.belongsToMany(vars.M, { through: NM, foreignKey: 'n_id', otherKey: 'm_id' });

    expect(NM.getAttributes().n_id.field).to.equal('nana_id');
    expect(NM.getAttributes().m_id.field).to.equal('mama_id');
  });
});
