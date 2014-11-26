<script type="text/javascript">
    fromGithub = function (partialId, ext) {
        ext = ext || '';

        var $partial = $("#" + partialId)
        $.get("https://cdn.rawgit.com/sequelize/express-example/master/" + partialId.replace("_", "/") + ext, function (code) {

            if (ext === '.js') {
                code = hljs.highlight('js', code).value;
            } 

            code = '<div class="highlight"><pre>' + code + '</pre></div>';
        
            $partial.replaceWith(code);
        }, 'html');
    }
</script>
## Introduction
This article explains the usage of Sequelize with the MVC framework Express.You will learn how and where to define models and how to load them when needed.

## A minimal express application
In order to create a minimal express application, we need to install express first and scaffold a project. We can do this via the following commands:

```bash
$ mkdir example-app
$ cd example-app
$ npm install express express-generator
$ node_modules/.bin/express . -f
$ npm install
$ ./bin/www
```

You should now be able to see a tiny welcome page on `http://localhost:3000`

## Adding Sequelize to the application
Now that we have the express application in place, we can start adding Sequelize to it. What we need for that are the following packages: sequelize, sequelize-cli, sqlite3. Please note, that for the sake of simplicity this tutorial will use SQLite.

```bash
$ npm install --save sequelize@2.0.0-rc1 sequelize-cli sqlite3
```

This will install the respective packages and uses the upcoming major release of sequelize. We can now let the sequelize CLI initialize the project's directory:

```bash
$ node_modules/.bin/sequelize init
```

Running this command will create the folders `config`, `migrations` and `models`.

## Implementing a todo app
As an example application we will create a very basic and simple todo tool, which allows the creation of users and the management of their tasks.

### bin/www
In order to create a maintainable application, we will put all the database logic into the `models` folder. When the application gets fired up, sequelize will sync the models with the database and afterwards start the server. This way we don't clutter the application while making use of sequelize's features.

<div id="bin_www"></div>
<script>$(function () { fromGithub("bin_www") })</script>

### models/index.js
This file has been generated with the sequelize CLI and collects all the models from the `models` directory and associates them if needed.
<div id="models_index"></div>
<script>$(function () { fromGithub("models_index", '.js') })</script>

### models/user.js
All models of our application are located as separate files in the `models` folder. If you want to add a new model, just add it to this folder and everything will work automagically. Also you can use the sequelize CLI's `sequelize model:create`.

**Notice** that the `associate` method receives a parameter `models`, which contains every declared model within the models directory.
<div id="models_user"></div>
<script>$(function () { fromGithub("models_user", '.js') })</script>

### models/task.js
The other needed model is `Task`. It relates to the `User`.
<div id="models_task"></div>
<script>$(function () { fromGithub("models_task", '.js') })</script>

### routes/index.js
The file `routes/index.js` contains the logic for a request against the main homepage. It loads the models module and uses it to load all the users and tasks from the database.
<div id="routes_index"></div>
<script>$(function () { fromGithub("routes_index", '.js') })</script>
This will allow us to iterate over the users in the view file. We will skip the rest of the route files for this article.

### views/index.jade
As we passed the users to the view and include the tasks for each user, we can access the data in the view's template file. Besides listing the users and tasks, there are also forms for creating new instances.
<div id="views_index"></div>
<script>$(function () { fromGithub("views_index", '.jade') })</script>

## What's next?
This article shows a basic approach of how to integrate Sequelize into an ExpressJS application. It allows the very easy management of models by adding new files to a specific folder. Starting the application will automatically sync the schema with the database.

If you don't want to have automatic schema synchronization and instead want migrations, just add a respective step to your deployment script. When you use the CLI for the model generation, you will gain the migration scripts for free as well.

You can find the complete application code [on Github](https://github.com/sequelize/express-example). Feel free to add pull requests to it.

Besides the use of Sequelize as model backend in your ExpressJS application, you might also want to turn your server into a restful API. If that is the case, check out [the repository on Github](https://github.com/sequelize/sequelize-restful)