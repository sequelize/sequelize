import { ConstraintChecking } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

const { name } = sequelize.dialect;
const queryGenerator = sequelize.queryGenerator;
const notSupportedError = new Error(`Deferrable constraints are not supported by ${name} dialect`);

describe('QueryGenerator#setConstraintCheckingQuery', () => {
  describe('DEFERRED constraints', () => {
    it('generates a deferred constraint checking query for all constraints', () => {
      expectsql(
        () => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.DEFERRED()),
        {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS ALL DEFERRED',
        },
      );
    });

    it('generates a deferred constraint checking query for all constraints with an empty array', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(ConstraintChecking.DEFERRED, []), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS ALL DEFERRED',
      });
    });

    it('generates a deferred constraint checking query for all constraints with an empty array for an instance', () => {
      expectsql(
        () => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.DEFERRED([])),
        {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS ALL DEFERRED',
        },
      );
    });

    it('generates a deferred constraint checking query for the specified constraints', () => {
      expectsql(
        () =>
          queryGenerator.setConstraintCheckingQuery(ConstraintChecking.DEFERRED, [
            'test1',
            'test2',
          ]),
        {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS "test1", "test2" DEFERRED',
        },
      );
    });

    it('generates a deferred constraint checking query for the specified constraints for an instance', () => {
      expectsql(
        () =>
          queryGenerator.setConstraintCheckingQuery(
            new ConstraintChecking.DEFERRED(['test1', 'test2']),
          ),
        {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS "test1", "test2" DEFERRED',
        },
      );
    });
  });

  describe('IMMEDIATE constraints', () => {
    it('generates an immediate constraint checking query for all constraints', () => {
      expectsql(
        () => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.IMMEDIATE()),
        {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS ALL IMMEDIATE',
        },
      );
    });

    it('generates an immediate constraint checking query for all constraints with an empty array', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery(ConstraintChecking.IMMEDIATE, []), {
        default: notSupportedError,
        'postgres snowflake': 'SET CONSTRAINTS ALL IMMEDIATE',
      });
    });

    it('generates an immediate constraint checking query for all constraints with an empty array for an instance', () => {
      expectsql(
        () => queryGenerator.setConstraintCheckingQuery(new ConstraintChecking.IMMEDIATE([])),
        {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS ALL IMMEDIATE',
        },
      );
    });

    it('generates an immediate constraint checking query for the specified constraints', () => {
      expectsql(
        () =>
          queryGenerator.setConstraintCheckingQuery(ConstraintChecking.IMMEDIATE, [
            'test1',
            'test2',
          ]),
        {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS "test1", "test2" IMMEDIATE',
        },
      );
    });

    it('generates an immediate constraint checking query for the specified constraints for an instance', () => {
      expectsql(
        () =>
          queryGenerator.setConstraintCheckingQuery(
            new ConstraintChecking.IMMEDIATE(['test1', 'test2']),
          ),
        {
          default: notSupportedError,
          'postgres snowflake': 'SET CONSTRAINTS "test1", "test2" IMMEDIATE',
        },
      );
    });
  });
});
