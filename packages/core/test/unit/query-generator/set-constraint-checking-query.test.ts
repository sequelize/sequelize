import { ConstraintChecking, Deferrable } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

const { name } = sequelize.dialect;
const notSupportedError = new Error(`Deferrable constraints are not supported by ${name} dialect`);

describe('QueryGenerator#setConstraintCheckingQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('throws an error if invalid type', () => {
    // @ts-expect-error -- We're testing invalid options
    expectsql(() => queryGenerator.setConstraintCheckingQuery('test'), {
      default: notSupportedError,
      'postgres snowflake': new Error(`Unknown constraint checking behavior test`),
    });
  });

  describe('Constraint Checking', () => {
    describe('DEFERRED constraints', () => {
      it('generates a constraint checking query for a deferred constraint', () => {
        expectsql(() => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.DEFERRED()), {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS ALL DEFERRED',
        });
      });

      it('generates a constraint checking query for a deferred constraint for all columns with an empty array', () => {
        expectsql(() => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.DEFERRED([]), []), {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS ALL DEFERRED',
        });
      });

      it('generates a constraint checking query for a deferred constraint with columns', () => {
        expectsql(() => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.DEFERRED(['test1', 'test2']), ['test1', 'test2']), {
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
        expectsql(() => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.IMMEDIATE([]), []), {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS ALL IMMEDIATE',
        });
      });

      it('generates a constraint checking query for an immediate constraint with columns', () => {
        expectsql(() => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.IMMEDIATE(['test1', 'test2']), ['test1', 'test2']), {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS "test1", "test2" IMMEDIATE',
        });
      });
    });
  });

  describe('Constraint Checking Behavior', () => {
    it('generates a constraint INITALLY DEFERRED query', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(Deferrable.INITIALLY_DEFERRED), {
        default: notSupportedError,
        'postgres snowflake': 'DEFERRABLE INITIALLY DEFERRED',
      });
    });

    it('generates a constraint INITIALLY IMMEDIATE query', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(Deferrable.INITIALLY_IMMEDIATE), {
        default: notSupportedError,
        'postgres snowflake': 'DEFERRABLE INITIALLY IMMEDIATE',
      });
    });

    it('generates a constraint NOT DEFERRABLE query', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(Deferrable.NOT), {
        default: notSupportedError,
        'postgres snowflake': 'NOT DEFERRABLE',
      });
    });
  });
});
