/**
 * Test where transaction.parent, returns `ROLLBACK TO SAVEPOINT ${this.quoteIdentifier(transaction.name, true)};` for abstract or `ROLLBACK TRANSACTION ${this.quoteIdentifier(transaction.name)};` for db2/mssql
 * Test where transaction, returns 'ROLLBACK;' for abstract or 'ROLLBACK TRANSACTION;' for db2/mssql
 */

//  rollbackTransactionQuery: [
//     {
//       arguments: [{}],
//       expectation: 'ROLLBACK;',
//       context: { options: { quoteIdentifiers: false } },
//     },
//     {
//       arguments: [{ parent: 'MockTransaction', name: 'transaction-uid' }],
//       expectation: 'ROLLBACK TO SAVEPOINT "transaction-uid";',
//       context: { options: { quoteIdentifiers: false } },
//     },
//     {
//       arguments: [{ parent: 'MockTransaction', name: 'transaction-uid' }],
//       expectation: 'ROLLBACK TO SAVEPOINT "transaction-uid";',
//       context: { options: { quoteIdentifiers: true } },
//     },
//   ],
