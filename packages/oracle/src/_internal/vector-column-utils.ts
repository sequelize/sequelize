import type {
  AbstractQueryInterface,
  QueryInterfaceIndexOptions,
  TableOrModel,
} from '@sequelize/core';

/**
 * Reads column metadata and validates the index against Oracle VECTOR restrictions.
 *
 * @see https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/create-tables-using-vector-data-type.html
 * @param queryInterface
 * @param tableName
 * @param attributes
 * @param options
 */
export async function validateOracleVectorIndex(
  queryInterface: AbstractQueryInterface,
  tableName: TableOrModel,
  attributes: string[] | QueryInterfaceIndexOptions,
  options?: QueryInterfaceIndexOptions,
): Promise<void> {
  const index = Array.isArray(attributes) ? { ...options, fields: attributes } : attributes;
  const { type: ignoreIndexType, ...describeOptions } = index;
  const columns = await queryInterface.describeTable(tableName, describeOptions);
  queryInterface.queryGenerator._validateAttributes(columns, [index]);
}

interface OracleColumnMetadata {
  type: string;
  allowNull?: boolean;
}

interface NormalizedAttribute {
  type?:
    | string
    | {
        getDataTypeId(): string;
        toSql(): string;
      };
  allowNull?: boolean;
  field?: string;
  columnName?: string;
}

interface VectorChangeQueryInterface {
  normalizeAttribute(attribute: unknown): NormalizedAttribute;
  describeTable(
    tableName: TableOrModel,
    options?: object,
  ): Promise<Record<string, OracleColumnMetadata>>;
}

interface OracleDescribeRow {
  DATA_TYPE: string;
  VECTOR_INFO?: string | null;
}

export function getOracleColumnType(row: OracleDescribeRow): string {
  const dataType = row.DATA_TYPE.toUpperCase();

  if (dataType !== 'VECTOR' || !row.VECTOR_INFO) {
    return dataType;
  }

  const vectorInfo = /^VECTOR\(\s*([^,]+)\s*,\s*([^\s,)]+)(?:\s*,\s*DENSE)?\s*\)$/i.exec(
    row.VECTOR_INFO,
  );
  if (!vectorInfo) {
    return row.VECTOR_INFO.toUpperCase();
  }

  return `VECTOR(${vectorInfo[1].toUpperCase()}, ${vectorInfo[2].toUpperCase()})`;
}

/**
 * Oracle rejects MODIFY statements for VECTOR columns even if their definition did not change.
 * Skip an unchanged VECTOR and reject real changes with an actionable error instead.
 *
 * @param queryInterface
 * @param tableName
 * @param attributeName
 * @param dataTypeOrOptions
 * @param options
 */
export async function shouldSkipOracleVectorColumnChange(
  queryInterface: VectorChangeQueryInterface,
  tableName: TableOrModel,
  attributeName: string,
  dataTypeOrOptions: unknown,
  options?: object,
): Promise<boolean> {
  const attribute = queryInterface.normalizeAttribute(dataTypeOrOptions);
  const type = attribute.type;
  if (
    typeof type !== 'object' ||
    type === null ||
    typeof type.getDataTypeId !== 'function' ||
    type.getDataTypeId() !== 'VECTOR'
  ) {
    return false;
  }

  const columnName = attribute.field ?? attribute.columnName ?? attributeName;
  const description = await queryInterface.describeTable(tableName, options);
  const currentColumn = description[attributeName] ?? description[columnName];

  if (!currentColumn) {
    throw new Error(`Could not find Oracle VECTOR column ${columnName} while changing its type.`);
  }

  const currentType = normalizeVectorSql(currentColumn.type);
  const requestedType = normalizeVectorSql(type.toSql());

  if (currentType === requestedType) {
    if (
      attribute.allowNull !== undefined &&
      currentColumn.allowNull !== undefined &&
      attribute.allowNull !== currentColumn.allowNull
    ) {
      throw new Error(
        `Changing nullability of Oracle VECTOR column ${columnName} is not supported by sync({ alter: true }). Use an explicit migration.`,
      );
    }

    return true;
  }

  if (currentType === 'VECTOR') {
    throw new Error(
      `Cannot safely change Oracle VECTOR column ${columnName}: its dimensions and element type were not returned by the database. Reconnect to Oracle Database 23.4 or newer and retry.`,
    );
  }

  throw new Error(
    `Changing Oracle VECTOR column ${columnName} from ${currentColumn.type} to ${type.toSql()} is not supported by sync({ alter: true }). Use an explicit migration to recreate the column.`,
  );
}

function normalizeVectorSql(type: string): string {
  return type.toUpperCase().replaceAll(/\s+/g, '');
}
