/* Connection string URL utils */
import path from 'path';
import url from 'url';
import pgConnectionString from 'pg-connection-string';
import type { Dialect, Options } from '../sequelize';

/**
 * Parses a connection string into an Options object with connection properties
 *
 * @param connectionString string value in format schema://username:password@host:port/database
 */
export function parseConnectionString(connectionString: string): Options {
  const urlParts = url.parse(connectionString, true);
  const options: Options = {};
  if (urlParts.protocol) {
    let protocol = urlParts.protocol.replace(/:$/, '');
    if (protocol === 'postgresql') {
      protocol = 'postgres';
    }

    options.dialect = protocol as Dialect;
  }

  if (urlParts.hostname != null) {
    options.host = urlParts.hostname;
  }

  if (urlParts.pathname) {
    options.database = urlParts.pathname.replace(/^\//, '');
  }

  if (urlParts.port) {
    options.port = urlParts.port;
  }

  if (urlParts.auth) {
    const authParts = urlParts.auth.split(':');
    options.username = authParts[0];
    if (authParts.length > 1) {
      options.password = authParts.slice(1).join(':');
    }
  }

  if (options.dialect === 'sqlite' && urlParts.pathname && !urlParts.pathname.startsWith('/:memory')) {
    const storagePath = path.join(options.host!, urlParts.pathname);
    options.storage = path.resolve(options.storage || storagePath);
  }

  if (urlParts.query) {
    // Allow host query argument to override the url host.
    // Enables specifying domain socket hosts which cannot be specified via the typical
    // host part of a url.
    if (urlParts.query.host) {
      options.host = urlParts.query.host as string;
    }

    options.dialectOptions = urlParts.query as object;
    if (urlParts.query.options) {
      try {
        const o = JSON.parse(urlParts.query.options as string);
        options.dialectOptions.options = o;
      } catch {
        // Nothing to do, string is not a valid JSON
        // an thus does not need any further processing
      }
    }
  }

  // For postgres, we can use this helper to load certs directly from the
  // connection string.
  if (options.dialect === 'postgres') {
    options.dialectOptions = options.dialectOptions || {};
    Object.assign(options.dialectOptions, pgConnectionString.parse(connectionString));
  }

  return options;
}
