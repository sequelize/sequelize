export interface DatabaseCollationLike {
  readonly codepage?: string | undefined;
}

export function isVarcharSafeString(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    // eslint-disable-next-line unicorn/prefer-code-point -- classifier intentionally checks UTF-16 code units
    if (value.charCodeAt(index) > 0x7f) {
      return false;
    }
  }

  return true;
}

export function escapeUserStringLiteral(value: string): string {
  const escapedValue = value.replaceAll("'", "''");

  return `${isVarcharSafeString(value) ? '' : 'N'}'${escapedValue}'`;
}

export function canBindAsVarChar(
  databaseCollation: DatabaseCollationLike | null | undefined,
): boolean {
  return Boolean(databaseCollation?.codepage);
}
