import qs from 'qs';

export default function parse(url, shouldParseQueryString) {
  // The `URL` constructor throws `TypeError [ERR_INVALID_URL]: Invalid URL`
  // when it encounters a URL like "sqlite://:memory:".
  let isSqliteMemoryUrl = false;
  if (url.indexOf('sqlite://:memory') === 0) {
    url = url.replace(/sqlite:\/\/:memory:?/, 'sqlite://memory');
    isSqliteMemoryUrl = true;
  }

  const parsedUrl = new URL(url);

  const location = {
    protocol: parsedUrl.protocol,
    pathname: parsedUrl.pathname,
    port: parsedUrl.port,
  };

  const { hostname: authAndHostname } = parsedUrl;

  if (authAndHostname.includes('@')) {
    const [auth, hostname] = authAndHostname.split('@');
    location.auth = auth;
    location.hostname = hostname;
  } else {
    location.hostname = authAndHostname;
  }

  if (isSqliteMemoryUrl) {
    location.hostname = '';
    location.pathname = `/:memory${location.pathname}`;
  }

  if (location.hostname.includes(':')) {
    const [host] = location.hostname.split(':');
    location.host = host;
  } else {
    location.host = location.hostname;
  }

  if (shouldParseQueryString) {
    location.query = parsedUrl.search ? qs.parse(parsedUrl.search.slice('?'.length)) : {};
  }

  return location;
}
