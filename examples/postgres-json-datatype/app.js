/*
  Title: PostgreSQL JSON Data-Type

  An example of using PostgreSQL's JSON data-type.
  In this example we create a single table that can handle multiple types of different media and it's metadata.

  This example uses the promise API preferred in 2.0 and above.
*/

var Sequelize = require(__dirname + "/../../index")
  , config    = require(__dirname + "/../../test/config/config")
  , sequelize = new Sequelize(config.postgres.database, config.postgres.username, config.postgres.password, {
    dialect: 'postgres',
    logging: false
  });

var Content = sequelize.define('Content', {
    title: { type: Sequelize.STRING },
    type: { type: Sequelize.STRING },
    metadata: { type: Sequelize.JSON }
  })
  , movie = Content.build({
    title: 'Grave of the Fireflies',
    type: 'Movie',
    metadata: {
      director: 'Isao Takahata',
      language: 'Japanese',
      year: 1988
    }
  })
  , episode = Content.build({
    title: 'Chapter 3',
    type: 'Episode',
    metadata: {
      season: 1,
      episode: 3,
      language: 'English',
      seriesTitle: 'House of Cards',
      genres: ['Drama', 'Political thriller']
    }
  });

sequelize.sync({ force: true })
  .then(function() {
    return sequelize.Promise.all([
      movie.save(),
      episode.save()
      ]);
  })
  .then(function() {
    console.log('=====================================');
    console.log('Searching for any content in Japanese');
    console.log('-------------------------------------');

    // Using nested object query syntax
    return Content.find({ where: Sequelize.json({ metadata: { language: 'Japanese' } }) })
      .then(function(content) {
        console.log('Result:', content.dataValues);
        console.log('=====================================');
      })
  })
  .then(function() {
    console.log('=====================================');
    console.log('Searching for any content in English');
    console.log('-------------------------------------');

    // Using the postgres json syntax
    return Content.find({ where: Sequelize.json("metadata->>'language'", 'English') })
      .then(function(content) {
        console.log('Result:', content.dataValues);
        console.log('=====================================');
      })
  })
  .then(function() {
    console.log('===========================================');
    console.log('Searching for series named "House of Cards"');
    console.log('-------------------------------------------');

    return Content.find({ where: Sequelize.json('metadata.seriesTitle', 'House of Cards') })
      .then(function(content) {
        console.log('Result:', content.dataValues);
        console.log('===========================================');
      })
  });