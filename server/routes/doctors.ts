import { Router, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../auth/middleware';
import { store } from '../db/store';
import type { PatientGender, PatientStatus } from '../types';

export const doctorsRouter = Router();

doctorsRouter.use(requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_STATUSES: PatientStatus[] = ['Stable', 'Under Observation', 'Critical', 'Discharged'];
const VALID_GENDERS: PatientGender[] = ['Male', 'Female', 'Other'];

doctorsRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const {
    search,
    specialization,
    hospital,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
    page,
    limit,
  } = req.query;

  const result = store.queryDoctors({
    search: typeof search === 'string' ? search : undefined,
    specialization: typeof specialization === 'string' ? specialization : undefined,
    hospital: typeof hospital === 'string' ? hospital : undefined,
    dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
    dateTo: typeof dateTo === 'string' ? dateTo : undefined,
    sortBy:
      sortBy === 'name' || sortBy === 'createdAt' || sortBy === 'patientCount' || sortBy === 'hospital'
        ? sortBy
        : 'createdAt',
    sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'desc',
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 8,
  });

  res.json(result);
});

doctorsRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const { name, specialization, hospital, phone, email } = req.body ?? {};
  const errors: Record<string, string> = {};

  if (typeof name !== 'string' || name.trim().length < 2) {
    errors.name = 'Doctor name is required (min 2 characters).';
  }
  if (typeof specialization !== 'string' || specialization.trim().length < 2) {
    errors.specialization = 'Specialization is required.';
  }
  if (typeof hospital !== 'string' || hospital.trim().length < 2) {
    errors.hospital = 'Hospital affiliation is required.';
  }
  if (typeof phone !== 'string' || phone.trim().length < 7) {
    errors.phone = 'Valid phone number is required.';
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    errors.email = 'Valid email address is required.';
  }

  if (Object.keys(errors).length > 0) {
    res.status(400).json({ error: 'Validation failed.', fields: errors });
    return;
  }

  try {
    const doctor = store.createDoctor({
      name,
      specialization,
      hospital,
      phone,
      email,
    });
    res.status(201).json({ doctor });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to create doctor.';
    res.status(409).json({ error: message });
  }
});

doctorsRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const doctor = store.getDoctorById(id);
  if (!doctor) {
    res.status(404).json({ error: 'Doctor not found.' });
    return;
  }
  const patients = store.getDoctorPatients(doctor.id);
  res.json({ doctor, patients });
});

doctorsRouter.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const { name, specialization, hospital, phone, email } = req.body ?? {};
  if (email !== undefined && (typeof email !== 'string' || !EMAIL_RE.test(email.trim()))) {
    res.status(400).json({ error: 'Valid email address is required.' });
    return;
  }

  try {
    const doctor = store.updateDoctor(id, { name, specialization, hospital, phone, email });
    res.json({ doctor });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to update doctor.';
    const status = message.includes('not found') ? 404 : 409;
    res.status(status).json({ error: message });
  }
});

doctorsRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  try {
    const result = store.deleteDoctor(id);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Doctor not found.';
    res.status(404).json({ error: message });
  }
});

doctorsRouter.get('/:id/patients', (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  try {
    const patients = store.getDoctorPatients(id);
    res.json({ patients });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Doctor not found.';
    res.status(404).json({ error: message });
  }
});

doctorsRouter.post('/:id/patients', (req: AuthenticatedRequest, res: Response) => {
  const doctorId = String(req.params.id);
  const { name, age, gender, phone, email, condition, status, notes, admittedAt } = req.body ?? {};

  const errors: Record<string, string> = {};
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
      doctorId,
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
    const message = err instanceof Error ? err.message : 'Unable to add patient.';
    res.status(404).json({ error: message });
  }
});

doctorsRouter.delete('/:id/patients/:patientId', (req: AuthenticatedRequest, res: Response) => {
  const doctorId = String(req.params.id);
  const patientId = String(req.params.patientId);
  try {
    const deleted = store.deleteDoctorPatient(doctorId, patientId);
    res.json({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Patient not found under this doctor.';
    res.status(404).json({ error: message });
  }
});
