import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model, sql } from '@sequelize/core';
import { Attribute, GeneratedAs, NotNull } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, sequelize } from '../../support';

describe('Model generated attributes', () => {
  const vars = beforeAll2(() => {
    class LineItem extends Model<InferAttributes<LineItem>, InferCreationAttributes<LineItem>> {
      declare id: CreationOptional<number>;

      @Attribute(DataTypes.INTEGER)
      @NotNull
      declare price: number;

      @Attribute(DataTypes.INTEGER)
      @NotNull
      @GeneratedAs(sql`${sql.attribute('price')} * 2`)
      declare doublePrice: CreationOptional<number>;

      @Attribute(DataTypes.INTEGER)
      @GeneratedAs({ expression: sql`${sql.attribute('price')} * 3`, stored: false })
      declare triplePrice: CreationOptional<number>;
    }

    sequelize.addModels([LineItem]);

    return { LineItem };
  });

  it('@GeneratedAs sets the generatedAs option', () => {
    const attributes = vars.LineItem.getAttributes();

    expect(attributes.doublePrice.generatedAs).to.deep.equal(sql`${sql.attribute('price')} * 2`);
    expect(attributes.triplePrice.generatedAs).to.deep.equal({
      expression: sql`${sql.attribute('price')} * 3`,
      stored: false,
    });
  });

  it('lists generated attributes in generatedAttributeNames', () => {
    expect([...vars.LineItem.modelDefinition.generatedAttributeNames]).to.deep.equal([
      'doublePrice',
      'triplePrice',
    ]);
  });

  it('ignores values set on generated attributes', () => {
    const item = vars.LineItem.build({ price: 1, doublePrice: 5 });
    expect(item.doublePrice).to.be.undefined;

    item.doublePrice = 5;
    expect(item.doublePrice).to.be.undefined;
    expect(item.changed()).to.deep.equal(['price']);
  });

  it('keeps values loaded from the database', () => {
    const item = vars.LineItem.build({ price: 1, doublePrice: 2 }, { raw: true });

    expect(item.doublePrice).to.equal(2);
  });

  it('does not validate generated attributes, the database computes them', async () => {
    // doublePrice is NOT NULL, but no value is provided
    await vars.LineItem.build({ price: 1 }).validate();
  });

  if (sequelize.dialect.supports.inserts.updateOnDuplicate) {
    it('removes generated attributes from updateOnDuplicate', async () => {
      const stub = sinon.stub(sequelize.queryInterface, 'bulkInsert').resolves([]);

      try {
        await vars.LineItem.bulkCreate([{ price: 1 }], {
          updateOnDuplicate: ['price', 'doublePrice'],
        });

        expect(stub.getCall(0).args[2]).to.have.deep.property('updateOnDuplicate', ['price']);
      } finally {
        stub.restore();
      }
    });
  }
});
