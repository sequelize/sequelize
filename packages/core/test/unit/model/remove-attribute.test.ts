import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import size from 'lodash/size';
import { getTestDialectTeaser, sequelize } from '../../support';

describe(getTestDialectTeaser('Model'), () => {
  describe('removeAttribute', () => {
    it('should support removing the primary key', () => {
      const Model = sequelize.define('m', {
        name: DataTypes.STRING,
      });

      expect(Model.primaryKeyAttribute).to.equal('id');
      expect(size(Model.primaryKeys)).to.equal(1);

      Model.removeAttribute('id');

      expect(Model.primaryKeyAttribute).to.be.null;
      expect(size(Model.primaryKeys)).to.equal(0);
    });

    it('should not add undefined attribute after removing primary key', () => {
      const Model = sequelize.define('m', {
        name: DataTypes.STRING,
      });

      Model.removeAttribute('id');

      const instance = Model.build();
      expect(instance.dataValues).not.to.include.keys('undefined');
    });
  });
});
