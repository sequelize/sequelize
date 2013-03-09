1.3.1
-----
- Fixing issue where it was no longer possible to check for an arbitrary cookie,
  while json is set to true, there was a SyntaxError thrown from JSON.parse.

1.3.0
-----
- Configuration options: `raw`, `json`. Replaces raw option, becomes config:

  ```javascript
  $.cookie.raw = true; // bypass encoding/decoding the cookie value
  $.cookie.json = true; // automatically JSON stringify/parse value
  ```
  
  Thus the default options now cleanly contain cookie attributes only.

- Removing licensing under GPL Version 2, the plugin is now released under MIT License only
(keeping it simple and following the jQuery library itself here).

- Bugfix: Properly handle RFC 2068 quoted cookie values.

- Added component.json for bower.

- Added jQuery plugin package manifest.

- `$.cookie()` returns all available cookies.

1.2.0
-----
- Adding `$.removeCookie('foo')` for deleting a cookie, using `$.cookie('foo', null)` is now deprecated.

1.1
---
- Adding default options.
