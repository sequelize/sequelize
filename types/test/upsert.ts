import {Model} from "sequelize"
import {sequelize} from './connection';

class TestModel extends Model {
}

TestModel.init({}, {sequelize})

sequelize.transaction(async trx => {
  const res: [TestModel, boolean] = await TestModel.upsert<TestModel>({}, {
    benchmark: true,
    fields: ['testField'],
    hooks: true,
    logging: true,
    returning: true,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  });

  let created: boolean = await TestModel.upsert<TestModel>({}, {
    benchmark: true,
    fields: ['testField'],
    hooks: true,
    logging: true,
    returning: false,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  });

  created = await TestModel.upsert<TestModel>({}, {
    benchmark: true,
    fields: ['testField'],
    hooks: true,
    logging: true,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  });
})
