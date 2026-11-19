import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDoctorForm, validatePatientForm } from './validation';

test('validateDoctorForm flags missing or invalid fields and passes valid payload', () => {
  const invalid = validateDoctorForm({
    name: 'A',
    specialization: '',
    hospital: '',
    phone: '123',
    email: 'not-an-email',
  });
  assert.ok(invalid.name);
  assert.ok(invalid.specialization);
  assert.ok(invalid.hospital);
  assert.ok(invalid.phone);
  assert.ok(invalid.email);

  const valid = validateDoctorForm({
    name: 'Dr. Sarah Jenkins',
    specialization: 'Cardiology',
    hospital: 'Metro General Hospital',
    phone: '+1 (415) 555-0144',
    email: 's.jenkins@metrogeneral.org',
  });
  assert.deepEqual(valid, {});
});

test('validatePatientForm enforces age bounds, email format, and doctor assignment', () => {
  const invalid = validatePatientForm({
    doctorId: '',
    name: '',
    age: 150,
    gender: 'Invalid',
    phone: '12',
    email: 'bad',
    condition: '',
    status: 'Stable',
  });
  assert.ok(invalid.doctorId);
  assert.ok(invalid.name);
  assert.ok(invalid.age);
  assert.ok(invalid.gender);
  assert.ok(invalid.phone);
  assert.ok(invalid.email);
  assert.ok(invalid.condition);

  const valid = validatePatientForm({
    doctorId: 'doc_01',
    name: 'Liam Carter',
    age: 42,
    gender: 'Male',
    phone: '+1 (415) 555-0188',
    email: 'liam.carter@example.com',
    condition: 'Hypertension',
    status: 'Stable',
  });
  assert.deepEqual(valid, {});
});
