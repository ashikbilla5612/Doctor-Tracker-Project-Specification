import { Router, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../auth/middleware';
import { store } from '../db/store';
import type { PatientGender, PatientStatus } from '../types';

export const patientsRouter = Router();

patientsRouter.use(requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_STATUSES: PatientStatus[] = ['Stable', 'Under Observation', 'Critical', 'Discharged'];
const VALID_GENDERS: PatientGender[] = ['Male', 'Female', 'Other'];

patientsRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const {
    search,
    condition,
    status,
    doctorId,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
    page,
    limit,
  } = req.query;

  const result = store.queryPatients({
    search: typeof search === 'string' ? search : undefined,
    condition: typeof condition === 'string' ? condition : undefined,
    status: typeof status === 'string' ? status : undefined,
    doctorId: typeof doctorId === 'string' ? doctorId : undefined,
    dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
    dateTo: typeof dateTo === 'string' ? dateTo : undefined,
    sortBy:
      sortBy === 'name' || sortBy === 'admittedAt' || sortBy === 'age' || sortBy === 'createdAt'
        ? sortBy
        : 'admittedAt',
    sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'desc',
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 8,
  });

  res.json(result);
});

patientsRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const { doctorId, name, age, gender, phone, email, condition, status, notes, admittedAt } = req.body ?? {};
  const errors: Record<string, string> = {};

  if (typeof doctorId !== 'string' || !doctorId.trim()) {
    errors.doctorId = 'Assigned doctor is required.';
  }
  if (typeof name !== 'string' || name.trim().length < 2) {
    errors.name = 'Patient name is required.';
  }
  const numericAge = Number(age);
  if (!Number.isFinite(numericAge) || numericAge < 0 || numericAge > 130) {
    errors.age = 'Age must be between 0 and 130.';
  }
  if (!VALID_GENDERS.includes(gender)) {
    errors.gender = 'Gender must be Male, Female, or Other.';
  }
  if (typeof phone !== 'string' || phone.trim().length < 7) {
    errors.phone = 'Valid phone number is required.';
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    errors.email = 'Valid email address is required.';
  }
  if (typeof condition !== 'string' || condition.trim().length < 2) {
    errors.condition = 'Medical condition is required.';
  }
  const resolvedStatus: PatientStatus = VALID_STATUSES.includes(status) ? status : 'Stable';

  if (Object.keys(errors).length > 0) {
    res.status(400).json({ error: 'Validation failed.', fields: errors });
    return;
  }

  try {
    const patient = store.createPatient({
      doctorId: doctorId.trim(),
      name,
      age: numericAge,
      gender,
      phone,
      email,
      condition,
      status: resolvedStatus,
      notes,
      admittedAt,
    });
    res.status(201).json({ patient });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to create patient.';
    res.status(400).json({ error: message });
  }
});

patientsRouter.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const { doctorId, name, age, gender, phone, email, condition, status, notes, admittedAt } = req.body ?? {};

  const errors: Record<string, string> = {};
  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
    errors.name = 'Patient name must be at least 2 characters.';
  }
  if (age !== undefined) {
    const numericAge = Number(age);
    if (!Number.isFinite(numericAge) || numericAge < 0 || numericAge > 130) {
      errors.age = 'Age must be between 0 and 130.';
    }
  }
  if (gender !== undefined && !VALID_GENDERS.includes(gender)) {
    errors.gender = 'Invalid gender value.';
  }
  if (email !== undefined && (typeof email !== 'string' || !EMAIL_RE.test(email.trim()))) {
    errors.email = 'Valid email address is required.';
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    errors.status = 'Invalid clinical status.';
  }

  if (Object.keys(errors).length > 0) {
    res.status(400).json({ error: 'Validation failed.', fields: errors });
    return;
  }

  try {
    const patient = store.updatePatient(id, {
      doctorId,
      name,
      age: age !== undefined ? Number(age) : undefined,
      gender,
      phone,
      email,
      condition,
      status,
      notes,
      admittedAt,
    });
    res.json({ patient });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to update patient.';
    const code = message.includes('not found') ? 404 : 400;
    res.status(code).json({ error: message });
  }
});

patientsRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  try {
    const deleted = store.deletePatient(id);
    res.json({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Patient not found.';
    res.status(404).json({ error: message });
  }
});
