import { ConstraintChecking } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

const { name } = sequelize.dialect;
const queryGenerator = sequelize.getQueryInterface().queryGenerator;
const notSupportedError = new Error(`Deferrable constraints are not supported by ${name} dialect`);

describe('QueryGenerator#setConstraintCheckingQuery', () => {
  describe('DEFERRED constraints', () => {
    it('generates a constraint checking query for a deferred constraint', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.DEFERRED()), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS ALL DEFERRED',
      });
    });

    it('generates a constraint checking query for a deferred constraint for all columns with an empty array', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(ConstraintChecking.DEFERRED, []), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS ALL DEFERRED',
      });
    });

    it('generates a constraint checking query for a deferred constraint for all columns with an empty array for an instance', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.DEFERRED([])), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS ALL DEFERRED',
      });
    });

    it('generates a constraint checking query for a deferred constraint with columns', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(ConstraintChecking.DEFERRED, ['test1', 'test2']), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS "test1", "test2" DEFERRED',
      });
    });

    it('generates a constraint checking query for a deferred constraint with columns for an instance', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.DEFERRED(['test1', 'test2'])), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS "test1", "test2" DEFERRED',
      });
    });
  });

  describe('IMMEDIATE constraints', () => {
    it('generates a constraint checking query for an immediate constraint', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.IMMEDIATE()), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS ALL IMMEDIATE',
      });
    });

    it('generates a constraint checking query for a immediate constraint for all columns with an empty array', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(ConstraintChecking.IMMEDIATE, []), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS ALL IMMEDIATE',
      });
    });

    it('generates a constraint checking query for a immediate constraint for all columns with an empty array for an instance', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.IMMEDIATE([])), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS ALL IMMEDIATE',
      });
    });

    it('generates a constraint checking query for an immediate constraint with columns', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(ConstraintChecking.IMMEDIATE, ['test1', 'test2']), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS "test1", "test2" IMMEDIATE',
      });
    });

    it('generates a constraint checking query for an immediate constraint with columns for an instance', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.IMMEDIATE(['test1', 'test2'])), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS "test1", "test2" IMMEDIATE',
      });
    });
  });
});
