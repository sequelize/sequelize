import { Model, Op } from 'sequelize';

class MyModel extends Model {}

const grouped: Promise<{ [key: string]: number }> = MyModel.count({ group: 'tag' });
const counted: Promise<number> = MyModel.count();
const countedDistinct: Promise<number> = MyModel.count({ col: 'tag', distinct: true });

const countedDistinctOnReader: Promise<number> = MyModel.count({ where: { updatedAt: { [Op.gte]: new Date() } }, useMaster: false })
