# Documentation

The sequelize documentation is divided in two parts:

- Tutorials, guides, and example based documentation are written in Markdown
- The API reference is generated automatically from source code comments with [ESDoc](http://esdoc.org) (which uses [JSDoc](http://usejsdoc.org) syntax).

The whole documentation is rendered using ESDoc and continuously deployed to Github Pages at https://sequelize.org. The output is produced in the `esdoc` folder.

The tutorials, written in markdown, are located in the `docs` folder. ESDoc is configured to find them in the `"manual"` field of `.esdoc.json`.

To generate the documentations locally, run `npm run docs` and open the generated `esdoc/index.html` in your favorite browser.
