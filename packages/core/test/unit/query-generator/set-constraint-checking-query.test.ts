import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#setConstraintCheckingQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('throws an error if invalid type', () => {
    // @ts-expect-error -- We're testing invalid options
    expectsql(() => queryGenerator.setConstraintCheckingQuery('test'), {
      default: new Error(`Invalid constraint checking type: test`),
    });
  });

  describe('DEFERRED constraints', () => {
    it('generates a constraint checking query for a deferred constraint', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery('DEFERRED'), {
        default: 'SET CONSTRAINTS ALL DEFERRED',
      });
    });

    it('generates a constraint checking query for a deferred constraint for all columns with an empty array', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery('DEFERRED', []), {
        default: 'SET CONSTRAINTS ALL DEFERRED',
      });
    });

    it('generates a constraint checking query for a deferred constraint with columns', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery('DEFERRED', ['test1', 'test2']), {
        default: 'SET CONSTRAINTS [test1], [test2] DEFERRED',
      });
    });
  });

  describe('IMMEDIATE constraints', () => {
    it('generates a constraint checking query for an immediate constraint', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery('IMMEDIATE'), {
        default: 'SET CONSTRAINTS ALL IMMEDIATE',
      });
    });

    it('generates a constraint checking query for a immediate constraint for all columns with an empty array', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery('IMMEDIATE', []), {
        default: 'SET CONSTRAINTS ALL IMMEDIATE',
      });
    });

    it('generates a constraint checking query for an immediate constraint with columns', () => {
      expectsql(() => queryGenerator.setConstraintCheckingQuery('IMMEDIATE', ['test1', 'test2']), {
        default: 'SET CONSTRAINTS [test1], [test2] IMMEDIATE',
      });
    });
  });
});
