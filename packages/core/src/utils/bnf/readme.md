> This readme is mostly for maintainers reviewing this PR, this should be rewritten/moved

### Omittion/Inclusion of build artifacts in the source code

In this folder only the `*.bnf` files are actual source code, the rest of the files are generated artifacts by `bnf-parser`.  
These could be omitted from the repo to clean up the source control, however that would then add an extra build step contributors would need to run locally before being able to work on the project.

While having compiled artifacts in source control is generally considered to not be a good idea, having these files could be helpful for maintainers who do not consider the `attribute-syntax`, as having these files in the source would mean than when updates to the `*.bnf` files are made, and changes are pulled locally, the updated artifacts are already there ready for use, rather than the maintainer needing to manually rebuild them if they pull a change that alters the `*.bnf` file.

### Race condition that needs resolving

While the current implementation works in NodeJS, the new syntax parser has a potential race condition which also can be resolve, but currently has not.
Within the `syntax.js` exports there is a `ready: Promise<void>` value. Ideally this should be a awaited on, on startup/initialisation of the library, because in some JS runtime environments, initialising the web assembly syntax parser is an asynchronous process with payloads over 4kb.

**Suggestion**  
This await condition could be placed into any function that initialises a database connection with `Promise.all` on the two processes, that way there will be no extra start up time created, and then the `parser` will certainly be ready by the time any sql needs to be processed.