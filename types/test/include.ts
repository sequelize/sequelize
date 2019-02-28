import { Model, Sequelize, HasMany } from 'sequelize';

class MyModel extends Model {
	public static associations: {
		relation: HasMany
	};
}

class AssociatedModel extends Model { }

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

MyModel.findAll({
	include: [{
		limit: 1,
		association: 'relation',
		order: [['id', 'DESC']],
		separate: true,
		where: { state: Sequelize.col('project.state') },
	}]
});
