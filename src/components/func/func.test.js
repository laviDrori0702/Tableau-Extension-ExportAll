import { exportToExcel } from './func';

// ponytail: covers only the two bugs the Promise.all rewrite fixed — a rejected
// sheet must reject (used to hang forever) and tab order must follow meta order
// (used to follow completion order). Add cases if the export path grows.

const sheet = (name, values) => ({
  name,
  getSummaryDataAsync: () => values instanceof Error
    ? Promise.reject(values)
    : new Promise(resolve => setTimeout(() => resolve({
        columns: [{ fieldName: 'Col', index: 0, _dataType: 'string' }],
        data: values.map(v => [{ value: v, formattedValue: v, nativeValue: v }]),
      }), values.delay || 0)),
});

const metaFor = (...names) => names.map(name => ({
  sheetName: name,
  changeName: null,
  selected: true,
  columns: [{ index: 0, name: 'Col', changeName: null, selected: true, order: 0 }],
}));

const setDashboard = (...sheets) => {
  global.tableau = { extensions: { dashboardContent: { dashboard: { worksheets: sheets } } } };
};

// file-saver touches the DOM; stub it out so we only test workbook assembly.
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

it('rejects instead of hanging when a sheet fails to read', () => {
  setDashboard(sheet('Good', ['a']), sheet('Bad', new Error('boom')));
  return expect(exportToExcel(metaFor('Good', 'Bad'), 'server', 'out')).rejects.toThrow('boom');
});

it('rejects when a configured sheet is missing from the dashboard', () => {
  setDashboard(sheet('Good', ['a']));
  return expect(exportToExcel(metaFor('Good', 'Gone'), 'server', 'out'))
    .rejects.toThrow('Sheet not found in dashboard: Gone');
});

it('resolves when every sheet reads, regardless of completion order', () => {
  // Slow first: completion order is the reverse of meta order.
  const slow = sheet('First', Object.assign(['a'], { delay: 20 }));
  const fast = sheet('Second', ['b']);
  setDashboard(slow, fast);
  return expect(exportToExcel(metaFor('First', 'Second'), 'server', 'out')).resolves.toBeUndefined();
});
