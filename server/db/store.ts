import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AnalyticsSummary,
  Doctor,
  DoctorQueryParams,
  DoctorWithStats,
  PaginatedResult,
  Patient,
  PatientGender,
  PatientQueryParams,
  PatientStatus,
  PatientWithDoctor,
  PublicUser,
  User,
} from '../types';
import { createSeedData } from './seed';

interface PersistedSchema {
  users: User[];
  doctors: Doctor[];
  patients: Patient[];
}

export class ClinicalDataStore {
  private users: Map<string, User> = new Map();
  private userEmailIdx: Map<string, string> = new Map();

  private doctors: Map<string, Doctor> = new Map();
  private doctorEmailIdx: Map<string, string> = new Map();
  private doctorSpecIdx: Map<string, Set<string>> = new Map();
  private doctorHospitalIdx: Map<string, Set<string>> = new Map();

  private patients: Map<string, Patient> = new Map();
  private patientDoctorIdx: Map<string, Set<string>> = new Map();
  private patientConditionIdx: Map<string, Set<string>> = new Map();
  private patientStatusIdx: Map<string, Set<string>> = new Map();

  private dbFilePath: string | null;

  constructor(options?: { dbFilePath?: string | null; seed?: boolean }) {
    this.dbFilePath = options?.dbFilePath === undefined
      ? process.env.DB_FILE_PATH || path.resolve(process.cwd(), 'data', 'doctor-tracker.json')
      : options.dbFilePath;

    if (this.dbFilePath && fs.existsSync(this.dbFilePath)) {
      this.loadFromDisk();
    } else if (options?.seed !== false) {
      const seed = createSeedData();
      this.hydrate(seed);
      this.persistToDisk();
    }
  }

  private hydrate(data: PersistedSchema): void {
    this.users.clear();
    this.userEmailIdx.clear();
    this.doctors.clear();
    this.doctorEmailIdx.clear();
    this.doctorSpecIdx.clear();
    this.doctorHospitalIdx.clear();
    this.patients.clear();
    this.patientDoctorIdx.clear();
    this.patientConditionIdx.clear();
    this.patientStatusIdx.clear();

    for (const user of data.users) {
      this.users.set(user.id, user);
      this.userEmailIdx.set(user.email.toLowerCase(), user.id);
    }

    for (const doctor of data.doctors) {
      this.indexDoctor(doctor);
    }

    for (const patient of data.patients) {
      this.indexPatient(patient);
    }
  }

  private indexDoctor(doctor: Doctor): void {
    this.doctors.set(doctor.id, doctor);
    this.doctorEmailIdx.set(doctor.email.toLowerCase(), doctor.id);

    const specKey = doctor.specialization.toLowerCase();
    if (!this.doctorSpecIdx.has(specKey)) this.doctorSpecIdx.set(specKey, new Set());
    this.doctorSpecIdx.get(specKey)!.add(doctor.id);

    const hospKey = doctor.hospital.toLowerCase();
    if (!this.doctorHospitalIdx.has(hospKey)) this.doctorHospitalIdx.set(hospKey, new Set());
    this.doctorHospitalIdx.get(hospKey)!.add(doctor.id);
  }

  private deindexDoctor(doctor: Doctor): void {
    this.doctors.delete(doctor.id);
    this.doctorEmailIdx.delete(doctor.email.toLowerCase());
    this.doctorSpecIdx.get(doctor.specialization.toLowerCase())?.delete(doctor.id);
    this.doctorHospitalIdx.get(doctor.hospital.toLowerCase())?.delete(doctor.id);
  }

  private indexPatient(patient: Patient): void {
    this.patients.set(patient.id, patient);

    if (!this.patientDoctorIdx.has(patient.doctorId)) {
      this.patientDoctorIdx.set(patient.doctorId, new Set());
    }
    this.patientDoctorIdx.get(patient.doctorId)!.add(patient.id);

    const condKey = patient.condition.toLowerCase();
    if (!this.patientConditionIdx.has(condKey)) {
      this.patientConditionIdx.set(condKey, new Set());
    }
    this.patientConditionIdx.get(condKey)!.add(patient.id);

    const statusKey = patient.status.toLowerCase();
    if (!this.patientStatusIdx.has(statusKey)) {
      this.patientStatusIdx.set(statusKey, new Set());
    }
    this.patientStatusIdx.get(statusKey)!.add(patient.id);
  }

  private deindexPatient(patient: Patient): void {
    this.patients.delete(patient.id);
    this.patientDoctorIdx.get(patient.doctorId)?.delete(patient.id);
    this.patientConditionIdx.get(patient.condition.toLowerCase())?.delete(patient.id);
    this.patientStatusIdx.get(patient.status.toLowerCase())?.delete(patient.id);
  }

  private loadFromDisk(): void {
    if (!this.dbFilePath) return;
    try {
      const raw = fs.readFileSync(this.dbFilePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedSchema;
      this.hydrate(parsed);
    } catch {
      const seed = createSeedData();
      this.hydrate(seed);
      this.persistToDisk();
    }
  }

  private persistToDisk(): void {
    if (!this.dbFilePath) return;
    const dir = path.dirname(this.dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload: PersistedSchema = {
      users: Array.from(this.users.values()),
      doctors: Array.from(this.doctors.values()),
      patients: Array.from(this.patients.values()),
    };
    const tmpPath = `${this.dbFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.dbFilePath);
  }

  // --- User operations ---
  findUserByEmail(email: string): User | null {
    const id = this.userEmailIdx.get(email.trim().toLowerCase());
    if (!id) return null;
    return this.users.get(id) ?? null;
  }

  findUserById(id: string): PublicUser | null {
    const user = this.users.get(id);
    if (!user) return null;
    const { passwordHash: _, ...pub } = user;
    return pub;
  }

  createUser(input: { name: string; email: string; passwordHash: string }): PublicUser {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (this.userEmailIdx.has(normalizedEmail)) {
      throw new Error('An account with this email already exists.');
    }
    const user: User = {
      id: `usr_${crypto.randomUUID().slice(0, 8)}`,
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      role: 'admin',
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    this.userEmailIdx.set(user.email, user.id);
    this.persistToDisk();
    const { passwordHash: _, ...pub } = user;
    return pub;
  }

  // --- Doctor operations ---
  getDoctorById(id: string): DoctorWithStats | null {
    const doc = this.doctors.get(id);
    if (!doc) return null;
    return {
      ...doc,
      patientCount: this.patientDoctorIdx.get(doc.id)?.size ?? 0,
    };
  }

  queryDoctors(params: DoctorQueryParams = {}): PaginatedResult<DoctorWithStats> {
    let candidateIds: Set<string> | null = null;

    if (params.specialization && params.specialization !== 'all') {
      const specSet = this.doctorSpecIdx.get(params.specialization.trim().toLowerCase()) ?? new Set();
      candidateIds = new Set(specSet);
    }

    if (params.hospital && params.hospital !== 'all') {
      const hospSet = this.doctorHospitalIdx.get(params.hospital.trim().toLowerCase()) ?? new Set();
      if (candidateIds === null) {
        candidateIds = new Set(hospSet);
      } else {
        for (const id of candidateIds) {
          if (!hospSet.has(id)) candidateIds.delete(id);
        }
      }
    }

    const pool: Doctor[] = candidateIds !== null
      ? Array.from(candidateIds).map((id) => this.doctors.get(id)!).filter(Boolean)
      : Array.from(this.doctors.values());

    const search = params.search?.trim().toLowerCase() ?? '';
    const dateFromMs = params.dateFrom ? Date.parse(`${params.dateFrom}T00:00:00.000Z`) : null;
    const dateToMs = params.dateTo ? Date.parse(`${params.dateTo}T23:59:59.999Z`) : null;

    const filtered: DoctorWithStats[] = [];
    for (const doc of pool) {
      if (dateFromMs !== null && !Number.isNaN(dateFromMs)) {
        if (Date.parse(doc.createdAt) < dateFromMs) continue;
      }
      if (dateToMs !== null && !Number.isNaN(dateToMs)) {
        if (Date.parse(doc.createdAt) > dateToMs) continue;
      }
      if (search) {
        const hay = `${doc.name} ${doc.specialization} ${doc.hospital} ${doc.email} ${doc.phone}`.toLowerCase();
        if (!hay.includes(search)) continue;
      }
      filtered.push({
        ...doc,
        patientCount: this.patientDoctorIdx.get(doc.id)?.size ?? 0,
      });
    }

    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    const dir = sortOrder === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      if (sortBy === 'patientCount') {
        return (a.patientCount - b.patientCount) * dir;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) * dir;
      }
      if (sortBy === 'hospital') {
        return a.hospital.localeCompare(b.hospital) * dir;
      }
      return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * dir;
    });

    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 8)));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;

    return {
      items: filtered.slice(start, start + limit),
      total,
      page: safePage,
      limit,
      totalPages,
    };
  }

  createDoctor(input: {
    name: string;
    specialization: string;
    hospital: string;
    phone: string;
    email: string;
  }): DoctorWithStats {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (this.doctorEmailIdx.has(normalizedEmail)) {
      throw new Error('A doctor with this email address already exists.');
    }
    const now = new Date().toISOString();
    const doctor: Doctor = {
      id: `doc_${crypto.randomUUID().slice(0, 8)}`,
      name: input.name.trim(),
      specialization: input.specialization.trim(),
      hospital: input.hospital.trim(),
      phone: input.phone.trim(),
      email: normalizedEmail,
      createdAt: now,
      updatedAt: now,
    };
    this.indexDoctor(doctor);
    this.persistToDisk();
    return { ...doctor, patientCount: 0 };
  }

  updateDoctor(
    id: string,
    updates: Partial<{
      name: string;
      specialization: string;
      hospital: string;
      phone: string;
      email: string;
    }>
  ): DoctorWithStats {
    const existing = this.doctors.get(id);
    if (!existing) {
      throw new Error('Doctor not found.');
    }

    const nextEmail = updates.email ? updates.email.trim().toLowerCase() : existing.email;
    if (nextEmail !== existing.email && this.doctorEmailIdx.has(nextEmail)) {
      throw new Error('Another doctor already uses this email address.');
    }

    this.deindexDoctor(existing);

    const updated: Doctor = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      specialization: updates.specialization !== undefined ? updates.specialization.trim() : existing.specialization,
      hospital: updates.hospital !== undefined ? updates.hospital.trim() : existing.hospital,
      phone: updates.phone !== undefined ? updates.phone.trim() : existing.phone,
      email: nextEmail,
      updatedAt: new Date().toISOString(),
    };

    this.indexDoctor(updated);
    this.persistToDisk();

    return {
      ...updated,
      patientCount: this.patientDoctorIdx.get(updated.id)?.size ?? 0,
    };
  }

  deleteDoctor(id: string): { deletedDoctor: Doctor; deletedPatientsCount: number } {
    const existing = this.doctors.get(id);
    if (!existing) {
      throw new Error('Doctor not found.');
    }

    const patientIds = Array.from(this.patientDoctorIdx.get(id) ?? []);
    for (const pid of patientIds) {
      const patient = this.patients.get(pid);
      if (patient) {
        this.deindexPatient(patient);
      }
    }
    this.patientDoctorIdx.delete(id);

    this.deindexDoctor(existing);
    this.persistToDisk();

    return {
      deletedDoctor: existing,
      deletedPatientsCount: patientIds.length,
    };
  }

  // --- Patient operations ---
  getDoctorPatients(doctorId: string): PatientWithDoctor[] {
    const doctor = this.doctors.get(doctorId);
    if (!doctor) {
      throw new Error('Doctor not found.');
    }
    const ids = Array.from(this.patientDoctorIdx.get(doctorId) ?? []);
    const list: PatientWithDoctor[] = [];
    for (const id of ids) {
      const p = this.patients.get(id);
      if (p) {
        list.push({
          ...p,
          doctorName: doctor.name,
          doctorSpecialization: doctor.specialization,
          doctorHospital: doctor.hospital,
        });
      }
    }
    list.sort((a, b) => Date.parse(b.admittedAt) - Date.parse(a.admittedAt));
    return list;
  }

  queryPatients(params: PatientQueryParams = {}): PaginatedResult<PatientWithDoctor> {
    let candidateIds: Set<string> | null = null;

    if (params.doctorId && params.doctorId !== 'all') {
      const docSet = this.patientDoctorIdx.get(params.doctorId) ?? new Set();
      candidateIds = new Set(docSet);
    }

    if (params.condition && params.condition !== 'all') {
      const condSet = this.patientConditionIdx.get(params.condition.trim().toLowerCase()) ?? new Set();
      if (candidateIds === null) {
        candidateIds = new Set(condSet);
      } else {
        for (const id of candidateIds) {
          if (!condSet.has(id)) candidateIds.delete(id);
        }
      }
    }

    if (params.status && params.status !== 'all') {
      const statusSet = this.patientStatusIdx.get(params.status.trim().toLowerCase()) ?? new Set();
      if (candidateIds === null) {
        candidateIds = new Set(statusSet);
      } else {
        for (const id of candidateIds) {
          if (!statusSet.has(id)) candidateIds.delete(id);
        }
      }
    }

    const pool: Patient[] = candidateIds !== null
      ? Array.from(candidateIds).map((id) => this.patients.get(id)!).filter(Boolean)
      : Array.from(this.patients.values());

    const search = params.search?.trim().toLowerCase() ?? '';
    const dateFromMs = params.dateFrom ? Date.parse(`${params.dateFrom}T00:00:00.000Z`) : null;
    const dateToMs = params.dateTo ? Date.parse(`${params.dateTo}T23:59:59.999Z`) : null;

    const filtered: PatientWithDoctor[] = [];
    for (const p of pool) {
      if (dateFromMs !== null && !Number.isNaN(dateFromMs)) {
        if (Date.parse(p.admittedAt) < dateFromMs) continue;
      }
      if (dateToMs !== null && !Number.isNaN(dateToMs)) {
        if (Date.parse(p.admittedAt) > dateToMs) continue;
      }
      const doc = this.doctors.get(p.doctorId);
      const doctorName = doc?.name ?? 'Unassigned';
      const doctorSpecialization = doc?.specialization ?? 'General';
      const doctorHospital = doc?.hospital ?? 'Unknown';

      if (search) {
        const hay = `${p.name} ${p.condition} ${p.email} ${p.phone} ${p.status} ${doctorName}`.toLowerCase();
        if (!hay.includes(search)) continue;
      }

      filtered.push({
        ...p,
        doctorName,
        doctorSpecialization,
        doctorHospital,
      });
    }

    const sortBy = params.sortBy || 'admittedAt';
    const sortOrder = params.sortOrder || 'desc';
    const dir = sortOrder === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortBy === 'age') return (a.age - b.age) * dir;
      if (sortBy === 'createdAt') return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * dir;
      return (Date.parse(a.admittedAt) - Date.parse(b.admittedAt)) * dir;
    });

    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 8)));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;

    return {
      items: filtered.slice(start, start + limit),
      total,
      page: safePage,
      limit,
      totalPages,
    };
  }

  createPatient(input: {
    doctorId: string;
    name: string;
    age: number;
    gender: PatientGender;
    phone: string;
    email: string;
    condition: string;
    status: PatientStatus;
    notes?: string;
    admittedAt?: string;
  }): PatientWithDoctor {
    const doctor = this.doctors.get(input.doctorId);
    if (!doctor) {
      throw new Error('Assigned doctor does not exist.');
    }
    const now = new Date().toISOString();
    const admittedIso = input.admittedAt
      ? (input.admittedAt.includes('T') ? input.admittedAt : `${input.admittedAt}T12:00:00.000Z`)
      : now;

    const patient: Patient = {
      id: `pat_${crypto.randomUUID().slice(0, 8)}`,
      doctorId: input.doctorId,
      name: input.name.trim(),
      age: Number(input.age),
      gender: input.gender,
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      condition: input.condition.trim(),
      status: input.status,
      notes: (input.notes || '').trim(),
      admittedAt: admittedIso,
      createdAt: now,
      updatedAt: now,
    };

    this.indexPatient(patient);
    this.persistToDisk();

    return {
      ...patient,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization,
      doctorHospital: doctor.hospital,
    };
  }

  updatePatient(
    id: string,
    updates: Partial<{
      doctorId: string;
      name: string;
      age: number;
      gender: PatientGender;
      phone: string;
      email: string;
      condition: string;
      status: PatientStatus;
      notes: string;
      admittedAt: string;
    }>
  ): PatientWithDoctor {
    const existing = this.patients.get(id);
    if (!existing) {
      throw new Error('Patient not found.');
    }

    const nextDoctorId = updates.doctorId ?? existing.doctorId;
    const doctor = this.doctors.get(nextDoctorId);
    if (!doctor) {
      throw new Error('Assigned doctor does not exist.');
    }

    this.deindexPatient(existing);

    const nextAdmitted = updates.admittedAt
      ? (updates.admittedAt.includes('T') ? updates.admittedAt : `${updates.admittedAt}T12:00:00.000Z`)
      : existing.admittedAt;

    const updated: Patient = {
      ...existing,
      doctorId: nextDoctorId,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      age: updates.age !== undefined ? Number(updates.age) : existing.age,
      gender: updates.gender ?? existing.gender,
      phone: updates.phone !== undefined ? updates.phone.trim() : existing.phone,
      email: updates.email !== undefined ? updates.email.trim().toLowerCase() : existing.email,
      condition: updates.condition !== undefined ? updates.condition.trim() : existing.condition,
      status: updates.status ?? existing.status,
      notes: updates.notes !== undefined ? updates.notes.trim() : existing.notes,
      admittedAt: nextAdmitted,
      updatedAt: new Date().toISOString(),
    };

    this.indexPatient(updated);
    this.persistToDisk();

    return {
      ...updated,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization,
      doctorHospital: doctor.hospital,
    };
  }

  deletePatient(id: string): Patient {
    const existing = this.patients.get(id);
    if (!existing) {
      throw new Error('Patient not found.');
    }
    this.deindexPatient(existing);
    this.persistToDisk();
    return existing;
  }

  deleteDoctorPatient(doctorId: string, patientId: string): Patient {
    const existing = this.patients.get(patientId);
    if (!existing || existing.doctorId !== doctorId) {
      throw new Error('Patient not found under this doctor.');
    }
    this.deindexPatient(existing);
    this.persistToDisk();
    return existing;
  }

  // --- Analytics & Facets ---
  getAnalytics(range: '7d' | '30d' | '90d' | 'all' = '30d'): AnalyticsSummary {
    const allDoctors = Array.from(this.doctors.values());
    const allPatients = Array.from(this.patients.values());

    // Determine reference latest date (using today or latest record)
    const nowMs = Date.now();
    let latestMs = nowMs;
    for (const p of allPatients) {
      const t = Date.parse(p.admittedAt);
      if (t > latestMs) latestMs = t;
    }

    const sevenDaysMs = latestMs - 7 * 86400_000;
    const thirtyDaysMs = latestMs - 30 * 86400_000;

    let activeCriticalCases = 0;
    let recentPatients7d = 0;
    for (const p of allPatients) {
      if (p.status === 'Critical') activeCriticalCases++;
      if (Date.parse(p.admittedAt) >= sevenDaysMs) recentPatients7d++;
    }

    let recentDoctors30d = 0;
    for (const d of allDoctors) {
      if (Date.parse(d.createdAt) >= thirtyDaysMs) recentDoctors30d++;
    }

    const totalDoctors = allDoctors.length;
    const totalPatients = allPatients.length;
    const avgPatientsPerDoctor = totalDoctors > 0
      ? Math.round((totalPatients / totalDoctors) * 10) / 10
      : 0;

    // Patients per doctor
    const patientsPerDoctor = allDoctors
      .map((doc) => {
        const docPatientIds = this.patientDoctorIdx.get(doc.id) ?? new Set();
        let criticalCount = 0;
        for (const pid of docPatientIds) {
          if (this.patients.get(pid)?.status === 'Critical') criticalCount++;
        }
        return {
          doctorId: doc.id,
          doctorName: doc.name,
          specialization: doc.specialization,
          hospital: doc.hospital,
          patientCount: docPatientIds.size,
          criticalCount,
        };
      })
      .sort((a, b) => b.patientCount - a.patientCount);

    // Date-based statistics grouped by date bucket
    const daysCount = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 60;
    const bucketMap = new Map<string, { patients: number; doctors: number }>();

    // Use the latest record date or 2026-11-18 as anchor so seeded data always populates cleanly
    const anchorDate = new Date(Math.max(
      Date.UTC(2026, 10, 18),
      ...allPatients.map((p) => Date.parse(p.admittedAt)),
      ...allDoctors.map((d) => Date.parse(d.createdAt))
    ));
    anchorDate.setUTCHours(0, 0, 0, 0);

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(anchorDate);
      d.setUTCDate(d.getUTCDate() - i);
      const isoKey = d.toISOString().slice(0, 10);
      bucketMap.set(isoKey, { patients: 0, doctors: 0 });
    }

    for (const p of allPatients) {
      const key = p.admittedAt.slice(0, 10);
      if (bucketMap.has(key)) {
        bucketMap.get(key)!.patients++;
      } else if (range === 'all') {
        bucketMap.set(key, { patients: 1, doctors: 0 });
      }
    }

    for (const d of allDoctors) {
      const key = d.createdAt.slice(0, 10);
      if (bucketMap.has(key)) {
        bucketMap.get(key)!.doctors++;
      } else if (range === 'all') {
        bucketMap.set(key, { patients: 0, doctors: 1 });
      }
    }

    const sortedDates = Array.from(bucketMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dateSeries = sortedDates.map(([date, counts]) => {
      const parsed = new Date(`${date}T00:00:00Z`);
      const label = parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
      return {
        date,
        label,
        patients: counts.patients,
        doctors: counts.doctors,
      };
    });

    // Condition breakdown
    const conditionCounts = new Map<string, number>();
    for (const p of allPatients) {
      conditionCounts.set(p.condition, (conditionCounts.get(p.condition) ?? 0) + 1);
    }
    const conditionBreakdown = Array.from(conditionCounts.entries())
      .map(([condition, count]) => ({
        condition,
        count,
        percentage: totalPatients > 0 ? Math.round((count / totalPatients) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Status breakdown
    const statuses: PatientStatus[] = ['Stable', 'Under Observation', 'Critical', 'Discharged'];
    const statusBreakdown = statuses.map((status) => ({
      status,
      count: this.patientStatusIdx.get(status.toLowerCase())?.size ?? 0,
    }));

    // Facets for filter dropdowns
    const specializations = Array.from(new Set(allDoctors.map((d) => d.specialization))).sort();
    const hospitals = Array.from(new Set(allDoctors.map((d) => d.hospital))).sort();
    const conditions = Array.from(new Set(allPatients.map((p) => p.condition))).sort();

    return {
      totals: {
        totalDoctors,
        totalPatients,
        avgPatientsPerDoctor,
        activeCriticalCases,
        recentPatients7d,
        recentDoctors30d,
      },
      patientsPerDoctor,
      dateSeries,
      conditionBreakdown,
      statusBreakdown,
      facets: {
        specializations,
        hospitals,
        conditions,
      },
    };
  }
}

export const store = new ClinicalDataStore();
