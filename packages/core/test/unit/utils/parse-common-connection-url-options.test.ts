import { parseCommonConnectionUrlOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/connection-options.js';
import { expect } from 'chai';

describe('parseCommonConnectionUrlOptions', () => {
  it('maps url parts to specified options', () => {
    const options = parseCommonConnectionUrlOptions<any>({
      stringSearchParams: ['search1', 'search2'],
      booleanSearchParams: ['search3'],
      numberSearchParams: ['search4'],
      allowedProtocols: ['mariadb'],
      hostname: 'theHost',
      password: 'thePassword',
      pathname: 'theDb',
      port: 'thePort',
      url: 'mariadb://a:b@c:1234/d?search1=1&search2=2&search3=true&search4=4',
      username: 'theUser',
    });

    expect(options).to.deep.eq({
      theDb: 'd',
      theHost: 'c',
      thePassword: 'b',
      thePort: 1234,
      theUser: 'a',
      search1: '1',
      search2: '2',
      search3: true,
      search4: 4,
    });
  });

  it('throws when specifying an unknown search param', () => {
    expect(() =>
      parseCommonConnectionUrlOptions<any>({
        url: 'mariadb://localhost?connectTimeout=1000',
        allowedProtocols: ['mariadb'],
        hostname: 'host',
        port: 'port',
        pathname: 'database',
      }),
    ).to.throw('Option "connectTimeout" cannot be set as a connection URL search parameter.');
  });

  it('throws when specifying an invalid value for boolean search param', () => {
    expect(() =>
      parseCommonConnectionUrlOptions<any>({
        booleanSearchParams: ['search'],
        url: 'mariadb://localhost?search=invalid',
        allowedProtocols: ['mariadb'],
        hostname: 'host',
        port: 'port',
        pathname: 'database',
      }),
    ).to.throwWithCause(
      'Cannot convert "invalid" to a boolean. It must be either "true" or "false".',
    );
  });

  it('throws when specifying an invalid value for number search param', () => {
    expect(() =>
      parseCommonConnectionUrlOptions<any>({
        numberSearchParams: ['search'],
        url: 'mariadb://localhost?search=invalid',
        allowedProtocols: ['mariadb'],
        hostname: 'host',
        port: 'port',
        pathname: 'database',
      }),
    ).to.throwWithCause('Cannot convert "invalid" to a finite number.');
  });

  it('throws an error if the protocol is not supported', () => {
    expect(() =>
      parseCommonConnectionUrlOptions<any>({
        url: 'mysql://localhost',
        allowedProtocols: ['mariadb'],
        hostname: 'host',
        port: 'port',
        pathname: 'database',
      }),
    ).to.throw(
      `URL "mysql://localhost" is not a valid connection URL. Expected the protocol to be one of "mariadb", but it's "mysql"`,
    );
  });

  it('supports not providing username, password, port, or database name', () => {
    const options = parseCommonConnectionUrlOptions<any>({
      allowedProtocols: ['mariadb'],
      hostname: 'host',
      pathname: 'database',
      url: 'mariadb://localhost',
      port: 'port',
    });

    expect(options).to.deep.eq({
      host: 'localhost',
    });
  });

  it('supports URL-encoded username, password, hostname, pathname, and search parameters keys and values', () => {
    const options = parseCommonConnectionUrlOptions<any>({
      stringSearchParams: ['search1', 'search2', '1', '2'],
      allowedProtocols: ['mariadb'],
      hostname: 'theHost',
      password: 'thePassword',
      pathname: 'theDb',
      port: 'thePort',
      url: 'mariadb://%61:%62@%63:1234/%64?search1=%31&search2=%32&%31=%31&%32=%32',
      username: 'theUser',
    });

    expect(options).to.deep.eq({
      theDb: 'd',
      theHost: 'c',
      thePassword: 'b',
      thePort: 1234,
      theUser: 'a',
      search1: '1',
      search2: '2',
      1: '1',
      2: '2',
    });
  });

  it('supports using a socket path as an encoded hostname', () => {
    const options = parseCommonConnectionUrlOptions<any>({
      allowedProtocols: ['postgres'],
      hostname: 'host',
      pathname: 'database',
      url: 'postgres://%2Ftmp%2Fmysocket:9821/dbname',
      port: 'port',
    });

    expect(options).to.deep.eq({
      host: '/tmp/mysocket',
      port: 9821,
      database: 'dbname',
    });
  });
});
