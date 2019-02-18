import { Config, Sequelize } from 'sequelize';

export const sequelize = new Sequelize({
  hooks: {
    afterConnect: (connection, config: Config) => {
      // noop
    }
  }
});

const conn = sequelize.connectionManager;

// hooks

sequelize.beforeCreate('test', () => {
    // noop
});

sequelize
    .addHook('beforeConnect', (config: Config) => {
        // noop
    })
    .addHook('beforeBulkSync', () => {
        // noop
    });

Sequelize.addHook('beforeCreate', () => {
    // noop
}).addHook('beforeBulkCreate', () => {
    // noop
});
