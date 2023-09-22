> This readme is mostly for maintainers reviewing this PR, this should be rewritten/moved

### Race condition that needs resolving

While the current implementation works in NodeJS, the new syntax parser has a potential race condition which also can be resolve, but currently has not.
Within the `syntax.js` exports there is a `ready: Promise<void>` value. Ideally this should be a awaited on, on startup/initialisation of the library, because in some JS runtime environments, initialising the web assembly syntax parser is an asynchronous process with payloads over 4kb.

**Suggestion**
This await condition could be placed into any function that initialises a database connection with `Promise.all` on the two processes, that way there will be no extra start up time created, and then the `parser` will certainly be ready by the time any sql needs to be processed.
