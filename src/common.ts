export type TableName =
  | string
  | {
      schema: string;
      tableName: string;
    };
