import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

describe('Model#previous', () => {
  it('should return correct previous value', () => {
    const Model = sequelize.define('Model', {
      text: DataTypes.STRING,
      textCustom: {
        type: DataTypes.STRING,
        set(val) {
          this.setDataValue('textCustom', val);
        },
        get() {
          this.getDataValue('textCustom');
        },
      },
    });

    const instance = Model.build({ text: 'a', textCustom: 'abc' });
    expect(instance.previous('text')).to.be.not.ok;
    expect(instance.previous('textCustom')).to.be.not.ok;

    instance.set('text', 'b');
    instance.set('textCustom', 'def');

    expect(instance.previous('text')).to.equal('a');
    expect(instance.previous('textCustom')).to.equal('abc');
  });
});
