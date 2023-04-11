import { expectTypeOf } from 'expect-type';
import type { BaseError, EmptyResultError, OptimisticLockError, UniqueConstraintError } from '@sequelize/core';

expectTypeOf<UniqueConstraintError>().toHaveProperty('sql').toBeString();
expectTypeOf<EmptyResultError>().toMatchTypeOf<BaseError>();
expectTypeOf<UniqueConstraintError>().toMatchTypeOf<BaseError>();
expectTypeOf<OptimisticLockError>().toMatchTypeOf<BaseError>();
