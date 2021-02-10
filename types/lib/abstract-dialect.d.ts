import { Sequelize } from './sequelize'

interface AbstractDialectConstructor {
  new(sequelize: Sequelize): AbstractDialect
}

export interface AbstractDialect {
  supports: {
    'DEFAULT': boolean,
    'DEFAULT VALUES': boolean,
    'VALUES ()': boolean,
    'LIMIT ON UPDATE': boolean,
    'ORDER NULLS': boolean,
    'UNION': boolean,
    'UNION ALL': boolean,
    'RIGHT JOIN': boolean,
  
    /* does the dialect support returning values for inserted/updated fields */
    returnValues: boolean,
  
    /* features specific to autoIncrement values */
    autoIncrement: {
      /* does the dialect require modification of insert queries when inserting auto increment fields */
      identityInsert: boolean,
  
      /* does the dialect support inserting default/null values for autoincrement fields */
      defaultValue: boolean,
  
      /* does the dialect support updating autoincrement fields */
      update: boolean
    },
    /* Do we need to say DEFAULT for bulk insert */
    bulkDefault: boolean,
    schemas: boolean,
    transactions: boolean,
    settingIsolationLevelDuringTransaction: boolean,
    transactionOptions: {
      type: boolean
    },
    migrations: boolean,
    upserts: boolean,
    inserts: {
      ignoreDuplicates: string, /* dialect specific words for INSERT IGNORE or DO NOTHING */
      updateOnDuplicate: boolean, /* whether dialect supports ON DUPLICATE KEY UPDATE */
      onConflictDoNothing: string /* dialect specific words for ON CONFLICT DO NOTHING */
    },
    constraints: {
      restrict: boolean,
      addConstraint: boolean,
      dropConstraint: boolean,
      unique: boolean,
      default: boolean,
      check: boolean,
      foreignKey: boolean,
      primaryKey: boolean
    },
    index: {
      collate: boolean,
      length: boolean,
      parser: boolean,
      concurrently: boolean,
      type: boolean,
      using: boolean,
      functionBased: boolean,
      operator: boolean
    },
    joinTableDependent: boolean,
    groupedLimit: boolean,
    indexViaAlter: boolean,
    JSON: boolean,
    deferrableConstraints: boolean
  }
  defaultVersion: string
  Query: object
  DataTypes: object
  name: string
  TICK_CHAR: string
  TICK_CHAR_LEFT: string
  TICK_CHAR_RIGHT: string
}