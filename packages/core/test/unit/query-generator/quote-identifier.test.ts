import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#quoteIdentifier', () => {
  const queryGenerator = sequelize.queryGenerator;
  const TICK_RIGHT = sequelize.dialect.TICK_CHAR_RIGHT;
  const TICK_LEFT = sequelize.dialect.TICK_CHAR_LEFT;

  it('escapes a value as an identifier', () => {
    expectsql(queryGenerator.quoteIdentifier(`'myTable'.'Test'`), {
      default: `['myTable'.'Test']`,
    });
  });

  it('escapes identifier quotes', () => {
    expectsql(
      queryGenerator.quoteIdentifier(
        `${TICK_LEFT}myTable${TICK_RIGHT}.${TICK_LEFT}Test${TICK_RIGHT}`,
      ),
      {
        default: `${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}myTable${TICK_RIGHT}${TICK_RIGHT}.${TICK_LEFT}${TICK_LEFT}Test${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT}`,
      },
    );
  });
});
