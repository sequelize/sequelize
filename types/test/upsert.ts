import {Model} from "sequelize"
import {sequelize} from './connection';

class TestModel extends Model {
  testColumn!: string;
}

TestModel.init({}, {sequelize})

sequelize.transaction(async trx => {

  // $ExpectType [TestModel, boolean]
  await TestModel.upsert({
    testColumn: '',
  }, {
    benchmark: true,
    fields: ['testField'],
    hooks: true,
    logging: true,
    returning: true,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  });

  await TestModel.upsert({
    // $ExpectError
    testColumn: 1
  }, {
    benchmark: true,
    fields: ['testField'],
    hooks: true,
    logging: true,
    returning: true,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  });

  // $ExpectType boolean
  await TestModel.upsert({}, {
    benchmark: true,
    fields: ['testField'],
    hooks: true,
    logging: true,
    returning: false,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  });

  // $ExpectType boolean
  await TestModel.upsert({}, {
    benchmark: true,
    fields: ['testField'],
    hooks: true,
    logging: true,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  });
})
