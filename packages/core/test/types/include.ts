import type { HasManyAssociation } from '@sequelize/core';
import { Model, Sequelize } from '@sequelize/core';

class MyModel extends Model {
  static associations: {
    relation: HasManyAssociation;
  };
}

class AssociatedModel extends Model {}

MyModel.findAll({
  include: [
    {
      duplicating: true,
      limit: 1,
      model: AssociatedModel,
      on: {
        a: 1,
      },
      order: [
        ['id', 'DESC'],
        ['AssociatedModel', MyModel, 'id', 'DESC'],
        [MyModel, 'id'],
      ],
      separate: true,
      where: { state: Sequelize.col('project.state') },
      all: true,
      nested: true,
    },
  ],
});

MyModel.findAll({
  include: [{ all: true }],
});

MyModel.findAll({
  include: [
    {
      limit: 1,
      association: 'relation',
      order: [['id', 'DESC'], 'id', [AssociatedModel, MyModel, 'id', 'ASC']],
      separate: true,
      where: { state: Sequelize.col('project.state') },
    },
  ],
});
