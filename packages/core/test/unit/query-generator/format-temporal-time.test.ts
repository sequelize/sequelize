import { TemporalTimeQueryType } from '@sequelize/core';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();
const notSupportedError = new Error(
  `formatTemporalTime has not been implemented in ${dialectName}.`,
);

describe('QueryGenerator#formatTemporalTime', () => {
  const internals = sequelize.queryGenerator.__TEST__getInternals();

  describe('Business Time', () => {
    it('produces a BUSINESS_TIME query for ALL', () => {
      expectsql(
        () =>
          internals.formatTemporalTime({
            type: 'BUSINESS_TIME',
            period: TemporalTimeQueryType.ALL,
          }),
        {
          default: notSupportedError,
        },
      );
    });

    it('produces a BUSINESS_TIME query for AS_OF', () => {
      const now = new Date();
      expectsql(
        () =>
          internals.formatTemporalTime({
            type: 'BUSINESS_TIME',
            period: TemporalTimeQueryType.AS_OF,
            startDate: now,
          }),
        {
          default: notSupportedError,
        },
      );
    });

    it('produces a BUSINESS_TIME query for BEWTEEN', () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 3600);
      expectsql(
        () =>
          internals.formatTemporalTime({
            type: 'BUSINESS_TIME',
            period: TemporalTimeQueryType.BETWEEN,
            startDate,
            endDate,
          }),
        {
          default: notSupportedError,
        },
      );
    });

    it('produces a BUSINESS_TIME query for FROM_TO', () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 3600);
      expectsql(
        () =>
          internals.formatTemporalTime({
            type: 'BUSINESS_TIME',
            period: TemporalTimeQueryType.FROM_TO,
            startDate,
            endDate,
          }),
        {
          default: notSupportedError,
        },
      );
    });

    it('produces a BUSINESS_TIME query for CONTAINED_IN', () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 3600);
      expectsql(
        () =>
          internals.formatTemporalTime({
            type: 'BUSINESS_TIME',
            period: TemporalTimeQueryType.CONTAINED_IN,
            startDate,
            endDate,
          }),
        {
          default: notSupportedError,
        },
      );
    });
  });

  describe('System Time', () => {
    it('produces a SYSTEM_TIME query for ALL', () => {
      expectsql(
        () =>
          internals.formatTemporalTime({
            type: 'SYSTEM_TIME',
            period: TemporalTimeQueryType.ALL,
          }),
        {
          default: notSupportedError,
        },
      );
    });

    it('produces a SYSTEM_TIME query for AS_OF', () => {
      const now = new Date();
      expectsql(
        () =>
          internals.formatTemporalTime({
            type: 'SYSTEM_TIME',
            period: TemporalTimeQueryType.AS_OF,
            startDate: now,
          }),
        {
          default: notSupportedError,
        },
      );
    });

    it('produces a SYSTEM_TIME query for BEWTEEN', () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 3600);
      expectsql(
        () =>
          internals.formatTemporalTime({
            type: 'SYSTEM_TIME',
            period: TemporalTimeQueryType.BETWEEN,
            startDate,
            endDate,
          }),
        {
          default: notSupportedError,
        },
      );
    });

    it('produces a SYSTEM_TIME query for FROM_TO', () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 3600);
      expectsql(
        () =>
          internals.formatTemporalTime({
            type: 'SYSTEM_TIME',
            period: TemporalTimeQueryType.FROM_TO,
            startDate,
            endDate,
          }),
        {
          default: notSupportedError,
        },
      );
    });

    it('produces a SYSTEM_TIME query for CONTAINED_IN', () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 3600);
      expectsql(
        () =>
          internals.formatTemporalTime({
            type: 'SYSTEM_TIME',
            period: TemporalTimeQueryType.CONTAINED_IN,
            startDate,
            endDate,
          }),
        {
          default: notSupportedError,
        },
      );
    });
  });
});
