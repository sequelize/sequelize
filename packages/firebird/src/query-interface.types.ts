// Public types exported by the Firebird query interface.
// Extend this file as the dialect grows.

export interface FirebirdDescribeColumnResult {
  type: string;
  allowNull: boolean;
  defaultValue: unknown;
  primaryKey: boolean;
}
