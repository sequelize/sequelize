import { Config, Sequelize, Model } from 'sequelize';
import { Fn } from '../lib/utils';

export const sequelize = new Sequelize({
  hooks: {
    afterConnect: (connection, config: Config) => {
      // noop
    }
  },
  retry: {
    max: 123,
    match: ['hurr'],
  },
  dialectModule: {},
});

const conn = sequelize.connectionManager;

// hooks

sequelize.hooks.add('beforeCreate', () => {
    // noop
});

sequelize
    .hooks.add('beforeConnect', (config: Config) => {
        // noop
    })
    .add('beforeBulkSync', () => {
        // noop
    });

Sequelize.hooks.add('beforeCreate', () => {
    // noop
})
.add('beforeBulkCreate', () => {
    // noop
});

Sequelize.hooks.add('beforeConnect', () => {

});

Sequelize.hooks.add('afterConnect', () => {

});

const rnd: Fn = sequelize.random();

const myModel: typeof Model = sequelize.models.asd;
