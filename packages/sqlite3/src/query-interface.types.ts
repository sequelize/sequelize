import type { BaseSqlExpression, ColumnDescription } from '@sequelize/core';

// SQLite needs to validate unqiue columns and foreign keys due to limitations in its ALTER TABLE implementation.
export interface SqliteColumnDescription extends ColumnDescription {
  generatedAs?: BaseSqlExpression;
  generatedColumn?: 'STORED' | 'VIRTUAL';
  unique?: boolean;
  references?: {
    table: string;
    key: string;
  };
}

export type SqliteColumnsDescription = Record<string, SqliteColumnDescription>;
