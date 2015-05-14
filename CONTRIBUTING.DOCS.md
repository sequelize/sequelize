# Documentation

The sequelize documentation is written in a combination of markdown (articles and example based documentation) and [JSDoc](http://usejsdoc.org) (API reference generated from source code comments).

All documentation is located in the `docs` folder.

The documentation is rendered using [mkdocs](http://mkdocs.org) and hosted at [Read the docs](http://sequelize.readthedocs.org).  Mkdocs generates static HTML from markdown files. The files in `articles` and `docs` should be edited directly, and the files in `api` are generated from source code comments (more on that later).

All pages in the documentation are defined in the `pages` section of `mkdocs.yml`. Each page is given as a separate line:
```yml
- ['index.md', 'Home', 'Welcome']
```

The first array element is the path of the markdown file, relative to the `docs` dir. The second element is the section the page should be placed in, and the third is the name of the page.

To view the docs locally use `mkdocs serve`. This will start a local server at port 8000. The documentation is automatically regenerated when you edit an `.md` file. However, you'll have to restart the server if you add new pages in the configuration file.

## Articles and example based docs
Write markdown, and have fun :)

## API docs
The API documentation is generated from source code comments by a custom script, which outputs markdown into the `docs/api` folder. To regenerate the documentation, run:
```bash
$ npm run docs
```
By default all generation will be regenerated, but you can run the generation for a single file by specifying `--file`.
