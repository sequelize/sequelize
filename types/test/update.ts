import { Model } from 'sequelize';
import { User } from './models/User';

class TestModel extends Model {
}

TestModel.update({}, { where: {} });
TestModel.update({}, { where: {}, returning: false });
TestModel.update({}, { where: {}, returning: true });
TestModel.update({}, { where: {}, returning: ['foo'] });


User.update({}, { where: {} });
User.update({}, { where: {}, returning: true });
User.update({}, { where: {}, returning: false });
User.update({}, { where: {}, returning: ['username'] });
// @ts-expect-error
User.update({}, { where: {}, returning: ['foo'] });
