import {Model} from "sequelize"
import {sequelize} from './connection';

class TestModel extends Model {
}

TestModel.init({}, {sequelize})

sequelize.transaction(trx => {
  TestModel.upsert<TestModel>({}, {
    benchmark: true,
    fields: ['testField'],
    hooks: true,
    logging: true,
    returning: true,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  }).then((res: [ TestModel, boolean ]) => {});

  TestModel.upsert<TestModel>({}, {
    benchmark: true,
    fields: ['testField'],
    hooks: true,
    logging: true,
    returning: false,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  }).then((created: boolean) => {});

  return TestModel.upsert<TestModel>({}, {
    benchmark: true,
    fields: ['testField'],
    hooks: true,
    logging: true,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  }).then((created: boolean) => {});
})
