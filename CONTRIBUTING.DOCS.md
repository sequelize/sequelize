# Documentation

The sequelize documentation is written in a combination of markdown (articles and example based documentation) and [JSDoc](http://usejsdoc.org) (API reference generated from source code comments).

All documentation is located in the `docs` folder.

The documentation is rendered using [esdoc](http://esdoc.org) and continously deployed to [Surge](http://surge.sh). esdoc generates static HTML from the code comments. 

All pages in the documentation are defined in the `manual` section of `.esdoc.json`. Each page is given as a separate line:

To view the docs locally run `npm run docs` and open the generated HTML in your favorite browser.

## Articles and example based docs
Write markdown, and have fun :)

## API docs
Change the source-code, and rerun `npm run docs` to see your changes.
