import assert from 'node:assert/strict';
import test from 'node:test';
import { ClinicalDataStore } from './store';

function createMemoryStore() {
  return new ClinicalDataStore({ dbFilePath: null, seed: true });
}

test('queryDoctors supports indexed specialization filtering, search, and pagination', () => {
  const db = createMemoryStore();

  const cardio = db.queryDoctors({ specialization: 'Cardiology', page: 1, limit: 10 });
  assert.equal(cardio.total, 2);
  assert.ok(cardio.items.every((d) => d.specialization === 'Cardiology'));

  const page1 = db.queryDoctors({ page: 1, limit: 4, sortBy: 'name', sortOrder: 'asc' });
  const page2 = db.queryDoctors({ page: 2, limit: 4, sortBy: 'name', sortOrder: 'asc' });
  assert.equal(page1.total, 10);
  assert.equal(page1.totalPages, 3);
  assert.equal(page1.items.length, 4);
  assert.equal(page2.items.length, 4);
  assert.notEqual(page1.items[0].id, page2.items[0].id);

  const searchResult = db.queryDoctors({ search: 'takahashi' });
  assert.equal(searchResult.total, 1);
  assert.equal(searchResult.items[0].name, 'Dr. Kenji Takahashi');
});

test('doctor patient management creates, lists, and deletes patients under a specific doctor', () => {
  const db = createMemoryStore();
  const initialPatients = db.getDoctorPatients('doc_08');
  assert.equal(initialPatients.length, 1);

  const created = db.createPatient({
    doctorId: 'doc_08',
    name: 'Test Patient Under Doc 08',
    age: 35,
    gender: 'Female',
    phone: '+1 (415) 555-0199',
    email: 'test.pat@example.com',
    condition: 'Psoriasis',
    status: 'Stable',
  });

  const afterCreate = db.getDoctorPatients('doc_08');
  assert.equal(afterCreate.length, 2);

  db.deleteDoctorPatient('doc_08', created.id);
  const afterDelete = db.getDoctorPatients('doc_08');
  assert.equal(afterDelete.length, 1);
});

test('queryPatients filters by condition, date range, and updates when editing patient', () => {
  const db = createMemoryStore();

  const hyper = db.queryPatients({ condition: 'Hypertension' });
  assert.equal(hyper.total, 3);

  const dated = db.queryPatients({ dateFrom: '2026-11-15', dateTo: '2026-11-18' });
  assert.ok(dated.total >= 3);
  assert.ok(dated.items.every((p) => p.admittedAt.slice(0, 10) >= '2026-11-15'));

  const target = hyper.items[0];
  const updated = db.updatePatient(target.id, {
    condition: 'Controlled Hypertension',
    status: 'Discharged',
  });
  assert.equal(updated.condition, 'Controlled Hypertension');
  assert.equal(updated.status, 'Discharged');

  const afterFilter = db.queryPatients({ condition: 'Controlled Hypertension' });
  assert.equal(afterFilter.total, 1);
});

test('getAnalytics aggregates totals, patients per doctor, and date series accurately', () => {
  const db = createMemoryStore();
  const analytics = db.getAnalytics('30d');

  assert.equal(analytics.totals.totalDoctors, 10);
  assert.equal(analytics.totals.totalPatients, 22);
  assert.equal(analytics.totals.avgPatientsPerDoctor, 2.2);
  assert.equal(analytics.dateSeries.length, 30);

  const totalFromBreakdown = analytics.statusBreakdown.reduce((sum, s) => sum + s.count, 0);
  assert.equal(totalFromBreakdown, 22);
});
