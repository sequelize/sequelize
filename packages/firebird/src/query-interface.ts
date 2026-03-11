import { AbstractQueryInterface } from '@sequelize/core';

/**
 * FirebirdQueryInterface
 *
 * Extends Sequelize's abstract QueryInterface with Firebird-specific DDL
 * operations, most notably auto-increment via SEQUENCE + BEFORE INSERT TRIGGER.
 */
export class FirebirdQueryInterface extends AbstractQueryInterface {}
