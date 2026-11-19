import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, signAuthToken, verifyAuthToken, verifyPassword } from './crypto';

test('hashPassword and verifyPassword validate matching credentials and reject wrong passwords', () => {
  const hash = hashPassword('ClinicalPass#2026');
  assert.equal(verifyPassword('ClinicalPass#2026', hash), true);
  assert.equal(verifyPassword('WrongPassword', hash), false);
  assert.equal(verifyPassword('ClinicalPass#2026', 'malformed-hash'), false);
});

test('signAuthToken and verifyAuthToken round-trip user payload and reject tampered or expired tokens', () => {
  const token = signAuthToken(
    {
      id: 'usr_1',
      name: 'Admin User',
      email: 'admin@doctortracker.org',
      role: 'admin',
      createdAt: '2026-11-18T00:00:00.000Z',
    },
    3600
  );

  const verified = verifyAuthToken(token);
  assert.ok(verified);
  assert.equal(verified.sub, 'usr_1');
  assert.equal(verified.email, 'admin@doctortracker.org');
  assert.equal(verified.role, 'admin');

  const tampered = `${token.slice(0, -4)}xxxx`;
  assert.equal(verifyAuthToken(tampered), null);

  const expiredToken = signAuthToken(
    {
      id: 'usr_1',
      name: 'Admin User',
      email: 'admin@doctortracker.org',
      role: 'admin',
      createdAt: '2026-11-18T00:00:00.000Z',
    },
    -10
  );
  assert.equal(verifyAuthToken(expiredToken), null);
});
