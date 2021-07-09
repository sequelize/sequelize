import { Model, Sequelize, HasMany, Op, col, fn, literal, where } from 'sequelize';

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
      order: [
        ['id', 'DESC'],
        ['AssociatedModel', MyModel, 'id', 'DESC'],
        ['AssociatedModel', MyModel, col('MyModel.id')],
        [MyModel, 'id'],
        'id',
        col('id'),
        fn('FN'),
        literal('<literal>'),
        where(col('id'), Op.eq, '<id>'),
        [col('id'), 'ASC'],
        [fn('FN'), 'DESC NULLS LAST'],
        [literal('<literal>'), 'NULLS FIRST'],
        [where(col('id'), Op.eq, '<id>'), 'DESC'],
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
  include: [{
    limit: 1,
    association: 'relation',
    order: [['id', 'DESC'], 'id', [ AssociatedModel, MyModel, 'id', 'ASC' ]],
    separate: true,
    where: { state: Sequelize.col('project.state') },
  }]
});
