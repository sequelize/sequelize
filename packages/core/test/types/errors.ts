import type {
  BaseError,
  EmptyResultError,
  OptimisticLockError,
  UniqueConstraintError,
} from '@sequelize/core';
import { expectTypeOf } from 'expect-type';

expectTypeOf<UniqueConstraintError>().toHaveProperty('sql').toBeString();
expectTypeOf<EmptyResultError>().toMatchTypeOf<BaseError>();
expectTypeOf<UniqueConstraintError>().toMatchTypeOf<BaseError>();
expectTypeOf<OptimisticLockError>().toMatchTypeOf<BaseError>();
