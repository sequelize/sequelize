import { expectTypeOf } from 'expect-type';
import { Model, DataTypes } from '../../../src';
import type { BelongsToAssociation, CreationOptional, HasManyAssociation, InferAttributes, InferCreationAttributes, NonAttribute } from '../../../src';
import { Attribute, PrimaryKey, AutoIncrement, BelongsTo, HasMany } from '../../../src/decorators/legacy';

interface UserRaw {
  id: number;
  username: string;
}

interface PostRaw {
  id: number;
  userId: number;
}

interface CommentRaw {
  id: number,
  postId: number,
  text: string
}

/**
 * Association form needs **static** associations on the model class with both source and target
 */
class User_Assoc extends Model<InferAttributes<User_Assoc>, InferCreationAttributes<User_Assoc>> implements UserRaw {
  declare id: CreationOptional<number>;

  declare username: string;

  declare static associations: {
    posts: HasManyAssociation<User_Assoc, Post_Assoc>;
  };
}

class Post_Assoc extends Model<InferAttributes<Post_Assoc>, InferCreationAttributes<Post_Assoc>> implements PostRaw {
  declare id: CreationOptional<number>;

  declare userId: number;

  declare static associations: {
    user: BelongsToAssociation<Post_Assoc, User_Assoc>;
    comments: HasManyAssociation<Post_Assoc, Comment_Assoc>;
  };
}

class Comment_Assoc extends Model<InferAttributes<Comment_Assoc>, InferCreationAttributes<Comment_Assoc>> implements CommentRaw {
  declare id: CreationOptional<number>;

  declare postId: number;

  declare text: string;

  declare static associations: {
    post: BelongsToAssociation<Post_Assoc>;
  };
}

/**
 * Attribute form needs declared or non-null-asserted property with `NonAttribute`
 */
class User_Attr extends Model<InferAttributes<User_Attr>, InferCreationAttributes<User_Attr>> implements UserRaw {
  @Attribute(DataTypes.INTEGER())
  @PrimaryKey
  @AutoIncrement
  id!: CreationOptional<number>;

  username!: string;

  @HasMany(() => Post_Attr, {})
  // Arrays are always non-null
  declare posts: NonAttribute<Post_Attr[]>;
}

class Post_Attr extends Model<InferAttributes<Post_Attr>, InferCreationAttributes<Post_Attr>> implements PostRaw {
  id!: CreationOptional<number>;

  userId!: number;

  @BelongsTo(() => User_Attr, {})
  // Base types can only be narrowed, so we must always explicitly declare NonAttribute generic as nullable.
  // TODO: useful to export a ReferenceTo<T extends Model> = NonAttribute<T | null>?
  user!: NonAttribute<User_Attr | null>;
}

// Test helpers to make the expectations a little more readable
type IsAssignableToEvery<T, U extends readonly unknown[]> =
  U extends readonly [infer H, ...infer R]
    ? [Extract<T, H>] extends [never]
      ? false
      : IsAssignableToEvery<T, R>
    : true;

type IsNotAssignableToAny<T, U extends readonly unknown[]> =
  U extends readonly [infer H, ...infer R]
    ? [Extract<T, H>] extends [never]
      ? IsNotAssignableToAny<T, R>
      : false
    : true;

type OptionalPick<T, K extends PropertyKey> =
  T extends null | undefined ? undefined :
  K extends keyof T ? T[K] : undefined;

describe('Utility types used in these tests', () => {
  describe('IsAssignableToEvery', () => {
    it('should match ALL, not ANY', () => {
      type TestType = null | undefined;
      type Valid = [null, undefined];
      type Invalid = [string, null, undefined];

      expectTypeOf<IsAssignableToEvery<TestType, Valid>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<TestType, Invalid>>().toEqualTypeOf<false>();
    });

    it('should correctly exclude undefined from null', () => {
      type TestType = string | null;
      type Valid = [string, null];
      type Invalid = [string, null, undefined];

      expectTypeOf<IsAssignableToEvery<TestType, Valid>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<TestType, Invalid>>().toEqualTypeOf<false>();
    });

    it('should correctly exclude null from undefined', () => {
      type TestType = string | undefined;
      type Valid = [string, undefined];
      type Invalid = [string, null];

      expectTypeOf<IsAssignableToEvery<TestType, Valid>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<TestType, Invalid>>().toEqualTypeOf<false>();
    });
  });
  describe('IsAssignableToNone', () => {
    it('should match ~ANY, not ~ALL', () => {
      type TestType = null | undefined;
      type Valid = [string, number];
      type Invalid = [string, null, undefined];

      expectTypeOf<IsNotAssignableToAny<TestType, Valid>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<TestType, Invalid>>().toEqualTypeOf<false>();
    });

    it('should correctly exclude undefined from null', () => {
      type TestType = string | null;
      type Valid = [undefined];
      type Invalid = [null, undefined];

      expectTypeOf<IsNotAssignableToAny<TestType, Valid>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<TestType, Invalid>>().toEqualTypeOf<false>();
    });

    it('should correctly exclude null from undefined', () => {
      type TestType = string | undefined;
      type Valid = [null];
      type Invalid = [null, undefined];

      expectTypeOf<IsNotAssignableToAny<TestType, Valid>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<TestType, Invalid>>().toEqualTypeOf<false>();
    });
  });
});

describe('Model#findOne - typescript augment checks', () => {

  describe('Simple returns on declared root', () => {
    it('should match on query', async () => {
      const query = async () => Post_Assoc.findOne({});
      type RT = Awaited<ReturnType<typeof query>>;

      type Match = [Post_Assoc, null];
      type NotMatch = [undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query', async () => {
      const query = async () => Post_Assoc.findOne({
        rejectOnEmpty: true,
      });
      type RT = Awaited<ReturnType<typeof query>>;

      type Match = [Post_Assoc];
      type NotMatch = [null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on raw query', async () => {
      const query = async () => Post_Assoc.findOne({
        raw: true,
      });
      type RT = Awaited<ReturnType<typeof query>>;

      type Match = [PostRaw, null];
      type NotMatch = [Post_Assoc, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on raw required query', async () => {
      const query = async () => Post_Assoc.findOne({
        raw: true,
        rejectOnEmpty: true,
      });
      type RT = Awaited<ReturnType<typeof query>>;

      type Match = [PostRaw];
      type NotMatch = [Post_Assoc, null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
    });
  });

  describe('Simple returns on decorated root', () => {
    it('should match on query', async () => {
      const query = async () => Post_Attr.findOne({});
      type RT = Awaited<ReturnType<typeof query>>;

      type Match = [Post_Attr, null];
      type NotMatch = [undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query', async () => {
      const query = async () => Post_Attr.findOne({
        rejectOnEmpty: true,
      });
      type RT = Awaited<ReturnType<typeof query>>;

      type Match = [Post_Attr];
      type NotMatch = [null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on raw query', async () => {
      const query = async () => Post_Attr.findOne({
        raw: true,
      });
      type RT = Awaited<ReturnType<typeof query>>;

      type Match = [PostRaw, null];
      type NotMatch = [Post_Attr, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();

    });

    it('should match on raw required query', async () => {
      const query = async () => Post_Attr.findOne({
        raw: true,
        rejectOnEmpty: true,
      });
      type RT = Awaited<ReturnType<typeof query>>;

      type Match = [PostRaw];
      type NotMatch = [Post_Attr, null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
    });
  });

  describe('Nullable declared root with one level of inclusion', () => {
    it('should match on query with model include', async () => {
      const query = async () => Post_Assoc.findOne({
        include: User_Assoc,
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Assoc, null];
      type NotMatch = [undefined];

      type ITMatch = [User_Assoc, null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with model include [array]', async () => {
      const query = async () => User_Assoc.findOne({
        include: Post_Assoc,
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'posts'>;

      type Match = [User_Assoc, null];
      type NotMatch = [undefined];

      type ITMatch = [Post_Assoc[], undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with option include', async () => {
      const query = async () => Post_Assoc.findOne({
        include: User_Assoc,
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Assoc, null];
      type NotMatch = [undefined];

      type ITMatch = [User_Assoc, null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with option include [array]', async () => {
      const query = async () => User_Assoc.findOne({
        include: Post_Assoc,
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'posts'>;

      type Match = [User_Assoc, null];
      type NotMatch = [undefined];

      type ITMatch = [Post_Assoc[], undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with named option include', async () => {
      const query = async () => Post_Assoc.findOne({
        include: {
          model: User_Assoc,
          as: 'somebody',
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'somebody'>;

      type Match = [Post_Assoc, null];
      type NotMatch = [undefined];

      type ITMatch = [User_Assoc, null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with named option include [array]', async () => {
      const query = async () => User_Assoc.findOne({
        include: {
          model: Post_Assoc,
          as: 'stuff',
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'stuff'>;

      type Match = [User_Assoc, null];
      type NotMatch = [undefined];

      type ITMatch = [Post_Assoc[], undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with required option include', async () => {
      const query = async () => Post_Assoc.findOne({
        include: {
          model: User_Assoc,
          required: true,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Assoc, null];
      type NotMatch = [undefined];

      type ITMatch = [User_Assoc, undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with required option include [array]', async () => {
      const query = async () => User_Assoc.findOne({
        include: {
          model: Post_Assoc,
          required: true,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'posts'>;

      type Match = [User_Assoc, null];
      type NotMatch = [undefined];

      type ITMatch = [Post_Assoc[], undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with named required option include', async () => {
      const query = async () => Post_Assoc.findOne({
        include: {
          model: User_Assoc,
          required: true,
          as: 'somebody',
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'somebody'>;

      type Match = [Post_Assoc, null];
      type NotMatch = [undefined];

      type ITMatch = [User_Assoc, undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with named required option include [array]', async () => {
      const query = async () => User_Assoc.findOne({
        include: {
          model: Post_Assoc,
          required: true,
          as: 'stuff',
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'stuff'>;

      type Match = [User_Assoc, null];
      type NotMatch = [undefined];

      type ITMatch = [Post_Assoc[], undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });
  });

  describe('Nullable decorated root with one level of inclusion', () => {
    it('should match on query with model include', async () => {
      const query = async () => Post_Attr.findOne({
        include: User_Attr,
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Attr, null];
      type NotMatch = [undefined];

      type ITMatch = [User_Attr, null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with model include [array]', async () => {
      const query = async () => User_Attr.findOne({
        include: Post_Attr,
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'posts'>;

      type Match = [User_Attr, null];
      type NotMatch = [undefined];

      type ITMatch = [Post_Attr[], undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with option include', async () => {
      const query = async () => Post_Attr.findOne({
        include: {
          model: User_Attr,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Attr, null];
      type NotMatch = [undefined];

      type ITMatch = [User_Attr, null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with option include [array]', async () => {
      const query = async () => User_Attr.findOne({
        include: {
          model: Post_Attr,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'posts'>;

      type Match = [User_Attr, null];
      type NotMatch = [undefined];

      type ITMatch = [Post_Attr[], undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with named option include', async () => {
      const query = async () => Post_Attr.findOne({
        include: {
          model: User_Attr,
          as: 'somebody',
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'somebody'>;

      type Match = [Post_Attr, null];
      type NotMatch = [undefined];

      type ITMatch = [User_Attr, null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with named option include [array]', async () => {
      const query = async () => User_Attr.findOne({
        include: {
          model: Post_Attr,
          as: 'stuff',
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'stuff'>;

      type Match = [User_Attr, null];
      type NotMatch = [undefined];

      type ITMatch = [Post_Attr[], undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with required option include', async () => {
      const query = async () => Post_Attr.findOne({
        include: {
          model: User_Attr,
          required: true,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Attr, null];
      type NotMatch = [undefined];

      type ITMatch = [User_Attr, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with required option include [array]', async () => {
      const query = async () => User_Attr.findOne({
        include: {
          model: Post_Attr,
          required: true,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'posts'>;

      type Match = [User_Attr, null];
      type NotMatch = [undefined];

      type ITMatch = [Post_Attr[], undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with named required option include', async () => {
      const query = async () => Post_Attr.findOne({
        include: {
          model: User_Attr,
          required: true,
          as: 'somebody',
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'somebody'>;

      type Match = [Post_Attr, null];
      type NotMatch = [undefined];

      type ITMatch = [User_Attr, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
    });

    it('should match on query with named required option include [array]', async () => {
      const query = async () => User_Attr.findOne({
        include: {
          model: Post_Attr,
          required: true,
          as: 'stuff',
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'stuff'>;

      type Match = [User_Attr, null];
      type NotMatch = [undefined];

      type ITMatch = [Post_Attr[], undefined];
      type ITNotMatch = [null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });
  });

  describe('Required declared root with one level of inclusion', () => {
    it('should match on required query with model include', async () => {
      const query = async () => Post_Assoc.findOne({
        rejectOnEmpty: true,
        include: User_Assoc,
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Assoc];
      type NotMatch = [null, undefined];

      type ITMatch = [User_Assoc, null];
      type ITNotMatch = [undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with option include', async () => {
      const query = async () => Post_Assoc.findOne({
        rejectOnEmpty: true,
        include: {
          model: User_Assoc,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Assoc];
      type NotMatch = [null, undefined];

      type ITMatch = [User_Assoc, null];
      type ITNotMatch = [undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with named option include', async () => {
      const query = async () => Post_Assoc.findOne({
        rejectOnEmpty: true,
        include: {
          model: User_Assoc,
          as: 'somebody',
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'somebody'>;

      type Match = [Post_Assoc];
      type NotMatch = [null, undefined];

      type ITMatch = [User_Assoc, null];
      type ITNotMatch = [undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with required option include', async () => {
      const query = async () => Post_Assoc.findOne({
        rejectOnEmpty: true,
        include: {
          model: User_Assoc,
          required: true,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Assoc];
      type NotMatch = [null, undefined];

      type ITMatch = [User_Assoc];
      type ITNotMatch = [null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with named required option include', async () => {
      const query = async () => Post_Assoc.findOne({
        rejectOnEmpty: true,
        include: {
          model: User_Assoc,
          as: 'somebody',
          required: true,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'somebody'>;

      type Match = [Post_Assoc];
      type NotMatch = [null, undefined];

      type ITMatch = [User_Assoc];
      type ITNotMatch = [null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });
  });

  describe('Required decorated root with one level of inclusion', () => {
    it('should match on required query with model include', async () => {
      const query = async () => Post_Attr.findOne({
        rejectOnEmpty: true,
        include: User_Attr,
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Attr];
      type NotMatch = [null, undefined];

      type ITMatch = [User_Attr, null];
      type ITNotMatch = [undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with option include', async () => {
      const query = async () => Post_Attr.findOne({
        rejectOnEmpty: true,
        include: {
          model: User_Attr,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Attr];
      type NotMatch = [null, undefined];

      type ITMatch = [User_Attr, null];
      type ITNotMatch = [undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with named option include', async () => {
      const query = async () => Post_Attr.findOne({
        rejectOnEmpty: true,
        include: {
          model: User_Attr,
          as: 'somebody',
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'somebody'>;

      type Match = [Post_Attr];
      type NotMatch = [null, undefined];

      type ITMatch = [User_Attr, null];
      type ITNotMatch = [undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with required option include', async () => {
      const query = async () => Post_Attr.findOne({
        rejectOnEmpty: true,
        include: {
          model: User_Attr,
          required: true,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Attr];
      type NotMatch = [null, undefined];

      type ITMatch = [User_Attr];
      type ITNotMatch = [null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with named required option include', async () => {
      const query = async () => Post_Attr.findOne({
        rejectOnEmpty: true,
        include: {
          model: User_Attr,
          as: 'somebody',
          required: true,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'somebody'>;

      type Match = [Post_Attr];
      type NotMatch = [null, undefined];

      type ITMatch = [User_Attr];
      type ITNotMatch = [null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with association object option include', async () => {
      const query = async () => Post_Attr.findOne({
        rejectOnEmpty: true,
        include: {
          association: Post_Attr.getAssociationWithModel(User_Attr, 'user'),
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'user'>;

      type Match = [Post_Attr];
      type NotMatch = [null, undefined];

      type ITMatch = [User_Attr, null];
      type ITNotMatch = [undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with association object option include [array]', async () => {
      const query = async () => User_Attr.findOne({
        rejectOnEmpty: true,
        include: {
          association: User_Attr.getAssociationWithModel(Post_Attr, 'posts'),
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'posts'>;

      type Match = [User_Attr];
      type NotMatch = [null, undefined];

      type ITMatch = [Post_Attr[]];
      type ITNotMatch = [null, undefined];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
    });
  });

  describe('recursion', () => {
    it('should match on required query with option included and nested model include', async () => {
      const query = async () => User_Assoc.findOne({
        rejectOnEmpty: true,
        include: {
          model: Post_Assoc,
          include: Comment_Assoc,
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      type IT = OptionalPick<RT, 'posts'>;
      type IT2 =  OptionalPick<IT[number], 'comments'>;

      type Match = [User_Assoc];
      type NotMatch = [undefined, null];

      type ITMatch = [Post_Assoc[]];
      type ITNotMatch = [undefined, null];

      type I2TMatch = [Comment_Assoc[]];
      type I2TNotMatch = [undefined, null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT2, I2TMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT2, I2TNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with option included and nested model include', async () => {
      const query = async () => User_Assoc.findOne({
        rejectOnEmpty: true,
        include: {
          model: Post_Assoc,
          as: 'secondary',
          include: {
            model: Comment_Assoc,
            as: 'tertiary',
          },
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      // const included = result.secondary;
      type IT = OptionalPick<RT, 'secondary'>;
      // const included2 = included?.[0].tertiary;
      type IT2 =  OptionalPick<IT[number], 'tertiary'>;

      type Match = [User_Assoc];
      type NotMatch = [undefined, null];

      type ITMatch = [Post_Assoc[]];
      type ITNotMatch = [undefined, null];

      type I2TMatch = [Comment_Assoc[]];
      type I2TNotMatch = [undefined, null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT2, I2TMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT2, I2TNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with option included and nested model include [raw]', async () => {
      const query = async () => User_Assoc.findOne({
        raw: true,
        rejectOnEmpty: true,
        include: {
          model: Post_Assoc,
          as: 'secondary',
          include: {
            model: Comment_Assoc,
            as: 'tertiary',
          },
        },
      });

      type RT = Awaited<ReturnType<typeof query>>;
      // const included = result.secondary;
      type IT = OptionalPick<RT, 'secondary'>;
      // const included2 = included?.[0].tertiary;
      type IT2 =  OptionalPick<IT[number], 'tertiary'>;

      type Match = [UserRaw];
      type NotMatch = [undefined, null, User_Assoc];

      type ITMatch = [PostRaw[]];
      type ITNotMatch = [undefined, null, Post_Assoc[]];

      type I2TMatch = [CommentRaw[]];
      type I2TNotMatch = [undefined, null, Comment_Assoc[]];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT2, I2TMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT2, I2TNotMatch>>().toEqualTypeOf<true>();
    });
  });

  describe('findAll', () => {
    it('should match on required query with option included and nested model include', async () => {
      const results = await User_Assoc.findAll({
        rejectOnEmpty: true,
        include: {
          model: Post_Assoc,
          include: Comment_Assoc,
        },
      });
      const included = results[0].posts;
      const included2 = included?.[0].comments;

      type RT = typeof results;
      type IT = typeof included;
      type IT2 = typeof included2;

      type Match = [User_Assoc[]];
      type NotMatch = [undefined, null];

      type ITMatch = [Post_Assoc[]];
      type ITNotMatch = [undefined, null];

      type I2TMatch = [Comment_Assoc[]];
      type I2TNotMatch = [undefined, null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT2, I2TMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT2, I2TNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with option included and nested model include', async () => {
      const results = await User_Assoc.findAll({
        rejectOnEmpty: true,
        include: {
          model: Post_Assoc,
          as: 'secondary',
          include: {
            model: Comment_Assoc,
            as: 'tertiary',
          },
        },
      });
      const included = results[0].secondary;
      const included2 = included?.[0].tertiary;

      type RT = typeof results;
      type IT = typeof included;
      type IT2 = typeof included2;

      type Match = [User_Assoc[]];
      type NotMatch = [undefined, null];

      type ITMatch = [Post_Assoc[]];
      type ITNotMatch = [undefined, null];

      type I2TMatch = [Comment_Assoc[]];
      type I2TNotMatch = [undefined, null];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT2, I2TMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT2, I2TNotMatch>>().toEqualTypeOf<true>();
    });

    it('should match on required query with option included and nested model include [raw]', async () => {
      const results = await User_Assoc.findAll({
        raw: true,
        rejectOnEmpty: true,
        include: {
          model: Post_Assoc,
          as: 'secondary',
          include: {
            model: Comment_Assoc,
            as: 'tertiary',
          },
        },
      });
      const included = results[0].secondary;
      const included2 = included?.[0].tertiary;

      type RT = typeof results;
      type IT = typeof included;
      type IT2 = typeof included2;

      type Match = [UserRaw[]];
      type NotMatch = [undefined, null, User_Assoc];

      type ITMatch = [PostRaw[]];
      type ITNotMatch = [undefined, null, Post_Assoc[]];

      type I2TMatch = [CommentRaw[]];
      type I2TNotMatch = [undefined, null, Comment_Assoc[]];

      expectTypeOf<IsAssignableToEvery<RT, Match>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<RT, NotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT, ITMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT, ITNotMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsAssignableToEvery<IT2, I2TMatch>>().toEqualTypeOf<true>();
      expectTypeOf<IsNotAssignableToAny<IT2, I2TNotMatch>>().toEqualTypeOf<true>();
    });
  });
});
