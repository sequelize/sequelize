import { expectTypeOf } from 'expect-type'
import { User } from './models/User';

async () => {
    const user = await User.create({
        id: 123,
        firstName: '<first-name>',
    }, {
        ignoreDuplicates: false,
        returning: true,
    });
    expectTypeOf(user).toEqualTypeOf<User>()

    const voidUser = await User.create({
        id: 123,
        firstName: '<first-name>',
    }, {
        ignoreDuplicates: true,
        returning: false,
    });
    expectTypeOf(voidUser).toEqualTypeOf<void>()

    const emptyUser = await User.create(undefined);
    expectTypeOf(emptyUser).toEqualTypeOf<User>()

    const partialUser = await User.create({
        id: 123,
        firstName: '<first-name>',
        lastName: '<last-name>',
    }, {
        fields: ['firstName'],
    });
    expectTypeOf(partialUser).toEqualTypeOf<User>()

    // @ts-expect-error missing attribute
    await User.create({
        id: 123,
    });
    await User.create({
        id: 123,
        firstName: '<first-name>',
        // @ts-expect-error unknown attribute
        unknown: '<unknown>',
    });
};
