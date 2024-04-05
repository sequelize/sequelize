import { SortDirection, basicComparator, localizedStringComparator } from '@sequelize/utils';
import { expect } from 'chai';

describe('localizedStringComparator', () => {
  it('sorts strings', () => {
    const items = ['0', '10', '2', '1'];

    items.sort(
      localizedStringComparator('en', SortDirection.ASC, {
        numeric: true,
      }),
    );

    expect(items).to.deep.eq(['0', '1', '2', '10']);
  });

  it('sorts strings (desc)', () => {
    const items = ['0', '10', '2', '1'];

    items.sort(
      localizedStringComparator('en', SortDirection.DESC, {
        numeric: true,
      }),
    );

    expect(items).to.deep.eq(['10', '2', '1', '0']);
  });
});

describe('basicComparator', () => {
  it('sorts numbers using > & <', () => {
    const items = [0, 10, 2, 1];

    items.sort(basicComparator());

    expect(items).to.deep.eq([0, 1, 2, 10]);
  });

  it('sorts bigints using > & <', () => {
    const items = [0n, 10n, 2n, 1n];

    items.sort(basicComparator());

    expect(items).to.deep.eq([0n, 1n, 2n, 10n]);
  });

  it('sorts unlocalized strings using > & <', () => {
    const items = ['0', '10', '2', '1'];

    items.sort(basicComparator());

    expect(items).to.deep.eq(['0', '1', '10', '2']);
  });

  it('sorts Date objects using > & <', () => {
    const items = [new Date(0), new Date(10), new Date(2), new Date(1)];

    items.sort(basicComparator());

    expect(items).to.deep.eq([new Date(0), new Date(1), new Date(2), new Date(10)]);
  });
});
