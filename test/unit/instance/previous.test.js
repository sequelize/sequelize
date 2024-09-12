'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../support');
const DataTypes = require('sequelize/lib/data-types');
const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('previous', () => {
    it('should return correct previous value', () => {
      const Model = current.define('Model', {
        text: DataTypes.STRING,
        textCustom: {
          type: DataTypes.STRING,
          set(val) {
            this.setDataValue('textCustom', val);
          },
          get() {
            this.getDataValue('textCustom');
          }
        }
      });

      const instance = Model.build({ text: 'a', textCustom: 'abc' });
      expect(instance.previous('text')).to.be.not.ok;
      expect(instance.previous('textCustom')).to.be.not.ok;

      instance.set('text', 'b');
      instance.set('textCustom', 'def');

      expect(instance.previous('text')).to.be.equal('a');
      expect(instance.previous('textCustom')).to.be.equal('abc');
    });
  });
});
