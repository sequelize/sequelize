import { expectTypeOf } from "expect-type";
import type { Attributes } from "@sequelize/core";
import { User } from "./models/user";

User.findOrCreate({
  where: { firstName: "Jonh" },
  // `defaults` shouldn't require all fields
  defaults: {
    lastName: "Smith",
  },
});

User.findOrCreate({
  // These attributes do not exist
  // @ts-expect-error -- this should error, if this doesn't error, findOrCreate has a bug!
  where: { blah: "blah2" },
  defaults: {
    firstName: "Jonh",
  },
});

User.findOrCreate({
  where: {
    firstName: "Jonh",
  },
  defaults: {
    // These attributes do not exist
    // @ts-expect-error -- this should error, if this doesn't error, findOrCreate has a bug!
    blah: "Jonh 2",
  },
});

(async () => {
  expectTypeOf(
    await User.findOrCreate({ where: { firstName: "John" } })
  ).toEqualTypeOf<[User, boolean]>();

  // raw

  User.findOrCreate({
    raw: true,
    where: { firstName: "John" },
  }).then((res) => {
    if (res[1]) {
      // if created
      expectTypeOf(res).toEqualTypeOf<[User, true]>();
    } else {
      expectTypeOf(res).toEqualTypeOf<[Attributes<User>, false]>();
    }
  });

  expectTypeOf(
    await User.findOrCreate({
      raw: false,
      where: { firstName: "John" },
    })
  ).toEqualTypeOf<[User, boolean]>();

  expectTypeOf(
    await User.findOrCreate({
      raw: undefined,
      where: { firstName: "John" },
    })
  ).toEqualTypeOf<[User, boolean]>();
})();
