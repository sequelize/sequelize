import { expect } from 'chai';
import { QueryTypes } from '@sequelize/core';
import type { CreationAttributes, Model, ModelStatic } from '@sequelize/core';

export async function testSimpleInOut<M extends Model, Key extends keyof CreationAttributes<M>>(
  model: ModelStatic<M>,
  attributeName: Key,
  inVal: CreationAttributes<M>[Key],
  outVal: CreationAttributes<M>[Key],
  message?: string,
): Promise<void> {
  // @ts-expect-error -- we can't guarantee that this model doesn't expect more than one property, but it's just a test util.
  const createdUser = await model.create({ [attributeName]: inVal });
  const fetchedUser = await model.findOne({
    rejectOnEmpty: true,
    where: {
      // @ts-expect-error -- it's not worth it to type .id for these internal tests.
      id: createdUser.id,
    },
  });
  expect(fetchedUser[attributeName]).to.deep.eq(outVal, message);
}

export async function testSimpleInOutRaw<M extends Model, Key extends keyof CreationAttributes<M>>(
  model: ModelStatic<M>,
  attributeName: Key,
  inVal: CreationAttributes<M>[Key],
  outVal: unknown,
  message?: string,
): Promise<void> {
  // @ts-expect-error -- we can't guarantee that this model doesn't expect more than one property, but it's just a test util.
  const createdUser = await model.create({ [attributeName]: inVal });

  const quotedTableName = model.queryGenerator.quoteIdentifier(model.tableName);
  const quotedId = model.queryGenerator.quoteIdentifier('id');
  const fetchedUser = await model.sequelize.query<any>(`SELECT * FROM ${quotedTableName} WHERE ${quotedId} = :id`, {
    type: QueryTypes.SELECT,
    replacements: {
      // @ts-expect-error -- it's not worth it to type .id for these internal tests.
      id: createdUser.id,
    },
  });

  expect(fetchedUser[0][attributeName]).to.deep.eq(outVal, message);
}
