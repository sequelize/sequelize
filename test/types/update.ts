import { Model, fn, col, literal } from 'sequelize';
import { User } from './models/User';

class TestModel extends Model {
}

TestModel.update({}, { where: {} });
TestModel.update({}, { where: {}, returning: false });
TestModel.update({}, { where: {}, returning: true });
TestModel.update({}, { where: {}, returning: ['foo'] });


User.update({}, { where: {} });
User.update({
    id: 123,
    username: fn('FN'),
    firstName: col('id'),
    lastName: literal('Smith'),
}, { where: {} });
User.update({}, { where: {}, returning: true });
User.update({}, { where: {}, returning: false });
User.update({}, { where: {}, returning: ['username'] });
User.build().update({
    id: 123,
    username: fn('FN'),
    firstName: col('id'),
    lastName: literal('Smith'),
});
// @ts-expect-error invalid `returning`
User.update({}, { where: {}, returning: ['foo'] });
// @ts-expect-error no `where`
User.update({}, {});
// @ts-expect-error invalid attribute
User.update({ foo: '<bar>' }, { where: {} });
// @ts-expect-error invalid attribute
User.build().update({ foo: '<bar>' });

