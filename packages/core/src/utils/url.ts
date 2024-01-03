import path from 'node:path';
import { URL } from 'node:url';
import type { ConnectionOptions } from 'pg-connection-string';
import pgConnectionString from 'pg-connection-string';
import type { Dialect, DialectOptions, Options } from '../sequelize';

/**
 * Parses a connection string into an Options object with connection properties
 *
 * @param connectionString string value in format schema://username:password@host:port/database
 */
export function parseConnectionString(connectionString: string): Options {
  const options: Options = {};

  // The following connectionStrings are not valid URLs, but they are supported by sqlite.
  if (connectionString.toLowerCase() === 'sqlite://:memory:' || connectionString.toLowerCase() === 'sqlite::memory:') {
    options.dialect = 'sqlite';
    options.host = '';

    return options;
  }

  const urlObject = new URL(connectionString);

  if (urlObject.protocol) {
    let protocol = urlObject.protocol.replace(/:$/, '');
    if (protocol === 'postgresql') {
      protocol = 'postgres';
    }

    options.dialect = protocol as Dialect;
  }

  if (urlObject.hostname) {
    options.host = urlObject.hostname;
  }

  if (urlObject.pathname) {
    // decode the URI component from urlObject.pathname value
    options.database = decodeURIComponent(urlObject.pathname.replace(/^\//, ''));
  }

  if (urlObject.port) {
    options.port = urlObject.port;
  }

  if (urlObject.username) {
    options.username = decodeURIComponent(urlObject.username);
  }

  if (urlObject.password) {
    options.password = decodeURIComponent(urlObject.password);
  }

  if (options.dialect === 'sqlite') {
    options.storage = path.resolve(urlObject.pathname);
  }

  if (urlObject.searchParams) {
    // Allow host query argument to override the url host.
    // Enables specifying domain socket hosts which cannot be specified via the typical
    // host part of a url.
    if (urlObject.searchParams.has('host')) {
      options.host = urlObject.searchParams.get('host')!;
    }

    options.dialectOptions = Object.fromEntries(urlObject.searchParams.entries());
    if (urlObject.searchParams.has('options')) {
      try {
        const o = JSON.parse(urlObject.searchParams.get('options')!);
        options.dialectOptions.options = o;
      } catch {
        // Nothing to do, string is not a valid JSON
        // and thus does not need any further processing
      }
    }
  }

  // For postgres, we can use this helper to load certs directly from the
  // connection string.
  if (options.dialect === 'postgres') {
    const parseResult: Partial<ConnectionOptions> = pgConnectionString.parse(connectionString);

    delete parseResult.database;
    delete parseResult.password;
    delete parseResult.user;
    delete parseResult.host;
    delete parseResult.port;
    delete parseResult.options; // we JSON.parse it

    options.dialectOptions ||= Object.create(null) as DialectOptions;
    Object.assign(options.dialectOptions, parseResult);
  }

  return options;
}
