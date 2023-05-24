import {Model} from "sequelize"
import {sequelize} from './connection';

class TestModel extends Model<{ foo: string; bar: string }, {}> {
}

TestModel.init({
    foo: '<foo>',
    bar: '<bar>',
}, {sequelize})

sequelize.transaction(async trx => {
  const res1: [TestModel, boolean | null] = await TestModel.upsert<TestModel>({}, {
    benchmark: true,
    fields: ['foo'],
    hooks: true,
    logging: true,
    returning: true,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  });

  const res2: [TestModel, boolean | null] = await TestModel.upsert<TestModel>({}, {
    benchmark: true,
    fields: ['foo'],
    hooks: true,
    logging: true,
    returning: false,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  });

  const res3: [TestModel, boolean | null] = await TestModel.upsert<TestModel>({}, {
    benchmark: true,
    fields: ['foo'],
    hooks: true,
    logging: true,
    returning: ['foo'],
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
    conflictFields: ['foo', 'bar']
  });

  const res4: [TestModel, boolean | null] = await TestModel.upsert<TestModel>({}, {
    conflictWhere: {
      foo: 'abc',
      bar: 'def',
    },
  });
})
