import { Model, Sequelize } from 'sequelize';

class MyModel extends Model {}

class AssociatedModel extends Model {}

MyModel.findAll({
    include: [
        {
            limit: 1,
            model: AssociatedModel,
            order: [['id', 'DESC']],
            separate: true,
            where: { state: Sequelize.col('project.state') },
        },
    ],
});

MyModel.findAll({
    include: [{ all: true }],
});
