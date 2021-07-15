import { expectTypeOf } from "expect-type";
import { BaseError, EmptyResultError, Error as AliasedBaseError, UniqueConstraintError } from 'sequelize';
import { OptimisticLockError } from '../lib/errors';

expectTypeOf<AliasedBaseError>().toEqualTypeOf<BaseError>();
expectTypeOf<UniqueConstraintError>().toHaveProperty('sql').toBeString();
expectTypeOf<EmptyResultError>().toMatchTypeOf<BaseError>();
expectTypeOf<UniqueConstraintError>().toMatchTypeOf<BaseError>();
expectTypeOf<OptimisticLockError>().toMatchTypeOf<BaseError>();
