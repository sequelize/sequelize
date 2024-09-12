'use strict';

module.exports = {
  index: `${__dirname}/index.md`,
  source: './src',
  destination: './esdoc',
  includes: ['\\.[tj]s$'],
  excludes: ['\\.d.ts$'],
  plugins: [
    {
      name: 'esdoc-ecmascript-proposal-plugin',
      option: {
        all: true
      }
    },
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
        manual: {
          asset: './docs/images',
          files: []
        }
      }
    },
    {
      name: './esdoc-ts'
    }
  ]
};
