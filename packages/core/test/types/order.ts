import type { HasOneAssociation } from '@sequelize/core';
import { Model } from '@sequelize/core';

class MyModel extends Model {
  static associations: {
    relation: HasOneAssociation;
  };
}

class AssociatedModel extends Model {}

MyModel.findAll({
  include: [
    {
      limit: 1,
      association: 'relation',
    },
  ],
  order: [
    ['id', 'DESC'],
    'id',
    [AssociatedModel, MyModel, 'id', 'ASC'],
    [
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      AssociatedModel,
      MyModel,
      'id',
      'ASC',
    ],
  ],
});
