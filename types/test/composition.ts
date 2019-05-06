import { composition, DataTypes, Sequelize } from 'sequelize'

declare const sequelize: Sequelize

sequelize.query(composition('SELECT ', sequelize.slot(1)))
sequelize.query(composition('SELECT ', sequelize.slot(1, DataTypes.NUMBER, {})))
