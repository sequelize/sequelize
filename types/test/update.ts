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

TestModel.update({ foo: 'bar' }, { where: {} });  // to validate models that were defined without types still allow any attribute/values

User.update({ username: 'name_123' }, { where: {} });
// @ts-expect-error
User.update({ foo: 'bar' }, { where: {} }); // because User doesn't have a `foo` attribute
