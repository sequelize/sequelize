import { Model, Sequelize, HasMany } from 'sequelize';

class MyModel extends Model {
  public static associations: {
    relation: HasMany
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
      order: [['id', 'DESC'], [ 'AssociatedModel', MyModel, 'id', 'DESC' ], [ MyModel, 'id' ] ],
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
  include: [{
    limit: 1,
    association: 'relation',
    order: [['id', 'DESC'], 'id', [ AssociatedModel, MyModel, 'id', 'ASC' ]],
    separate: true,
    where: { state: Sequelize.col('project.state') },
  }]
});
