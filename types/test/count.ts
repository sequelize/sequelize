import { Model, Promise } from 'sequelize';

class MyModel extends Model {}

const grouped: Promise<{ [key: string]: number }> = MyModel.count({ group: 'tag' });
const counted: Promise<number> = MyModel.count();
const countedDistinct: Promise<number> = MyModel.count({ col: 'tag', distinct: true });