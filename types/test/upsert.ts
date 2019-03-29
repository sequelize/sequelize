import {Model} from "sequelize"
import {sequelize} from './connection';

class TestModel extends Model {
}

TestModel.init({}, {sequelize})

sequelize.transaction(trx => {
  return TestModel.upsert({}, {
    benchmark: true,
    fields: ['testField'],
    hooks: true,
    logging: true,
    returning: true,
    searchPath: 'DEFAULT',
    transaction: trx,
    validate: true,
  })
})
