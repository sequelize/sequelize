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

  describe('hostile identifiers', () => {
    // Attribute names accept any character that is not reserved by the attribute syntax (see attribute-syntax.ts),
    // so these identifiers can reach quoteIdentifier through a WHERE POJO or sql.attribute().
    // quoteIdentifier must neutralize them by wrapping the identifier in the dialect's delimiter,
    // and doubling every occurrence of the delimiter characters (and only those) inside the identifier.
    // The expectations are listed explicitly per dialect (instead of relying on the [] placeholder)
    // so that the exact output is pinned.
    const cases: Array<{
      input: string;
      doubleQuotes: string;
      backticks: string;
      brackets: string;
    }> = [
      { input: 'a"b', doubleQuotes: '"a""b"', backticks: '`a"b`', brackets: '[a"b]' },
      { input: 'a`b', doubleQuotes: '"a`b"', backticks: '`a``b`', brackets: '[a`b]' },
      { input: 'a]b', doubleQuotes: '"a]b"', backticks: '`a]b`', brackets: '[a]]b]' },
      { input: 'a[b', doubleQuotes: '"a[b"', backticks: '`a[b`', brackets: '[a[[b]' },
      { input: 'a[0]', doubleQuotes: '"a[0]"', backticks: '`a[0]`', brackets: '[a[[0]]]' },
      { input: "a'b", doubleQuotes: `"a'b"`, backticks: "`a'b`", brackets: "[a'b]" },
      { input: 'a;b', doubleQuotes: '"a;b"', backticks: '`a;b`', brackets: '[a;b]' },
      { input: 'a--b', doubleQuotes: '"a--b"', backticks: '`a--b`', brackets: '[a--b]' },
      { input: 'a/*b', doubleQuotes: '"a/*b"', backticks: '`a/*b`', brackets: '[a/*b]' },
      { input: 'a\\b', doubleQuotes: '"a\\b"', backticks: '`a\\b`', brackets: '[a\\b]' },
      { input: 'a b', doubleQuotes: '"a b"', backticks: '`a b`', brackets: '[a b]' },
      { input: 'café', doubleQuotes: '"café"', backticks: '`café`', brackets: '[café]' },
      { input: '日本', doubleQuotes: '"日本"', backticks: '`日本`', brackets: '[日本]' },
      {
        input: `"'\`[]`,
        doubleQuotes: `"""'\`[]"`,
        backticks: `\`"'\`\`[]\``,
        brackets: `["'\`[[]]]`,
      },
      {
        input: `a"; DROP TABLE users; --`,
        doubleQuotes: `"a""; DROP TABLE users; --"`,
        backticks: `\`a"; DROP TABLE users; --\``,
        brackets: `[a"; DROP TABLE users; --]`,
      },
      {
        input: 'a`; DROP TABLE users; --',
        doubleQuotes: '"a`; DROP TABLE users; --"',
        backticks: '`a``; DROP TABLE users; --`',
        brackets: '[a`; DROP TABLE users; --]',
      },
      {
        input: 'a]; DROP TABLE users; --',
        doubleQuotes: '"a]; DROP TABLE users; --"',
        backticks: '`a]; DROP TABLE users; --`',
        brackets: '[a]]; DROP TABLE users; --]',
      },
    ];

    for (const { input, doubleQuotes, backticks, brackets } of cases) {
      it(`quotes ${JSON.stringify(input)}`, () => {
        expectsql(queryGenerator.quoteIdentifier(input), {
          postgres: doubleQuotes,
          db2: doubleQuotes,
          ibmi: doubleQuotes,
          snowflake: doubleQuotes,
          oracle: doubleQuotes,
          mysql: backticks,
          mariadb: backticks,
          sqlite3: backticks,
          mssql: brackets,
        });
      });
    }
  });
});
