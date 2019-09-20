'use strict';

const _ = require('lodash');

const manualGroups = require('./manual-groups.json');

const manual = {
  index: './docs/index.md',
  globalIndex: true,
  asset: './docs/images',
  files: _.flatten(_.values(manualGroups)).map(file => `./docs/manual/${file}`)
};

module.exports = {
  source: './lib',
  destination: './esdoc',
  includes: ['\\.js$'],
  plugins: [
    {
      name: 'esdoc-inject-style-plugin',
      option: {
        enable: true,
        styles: [
          './docs/css/style.css',
          './docs/css/theme.css'
        ]
      }
    },
    {
      name: 'esdoc-standard-plugin',
      option: {
        lint: { enable: true },
        coverage: { enable: false },
        accessor: {
          access: ['public'],
          autoPrivate: true
        },
        undocumentIdentifier: { enable: false },
        unexportedIdentifier: { enable: true },
        typeInference: { enable: true },
        brand: {
          logo: './docs/images/logo-small.png',
          title: 'Sequelize',
          description: 'An easy-to-use multi SQL dialect ORM for Node.js',
          repository: 'https://github.com/sequelize/sequelize',
          site: 'https://sequelize.org/master/'
        },
        manual
      }
    }
  ]
};
