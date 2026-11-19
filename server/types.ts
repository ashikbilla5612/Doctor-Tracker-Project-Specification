export type UserRole = 'admin' | 'coordinator';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorWithStats extends Doctor {
  patientCount: number;
}

export type PatientStatus = 'Stable' | 'Under Observation' | 'Critical' | 'Discharged';
export type PatientGender = 'Male' | 'Female' | 'Other';

export interface Patient {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface PatientWithDoctor extends Patient {
  doctorName: string;
  doctorSpecialization: string;
  doctorHospital: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DoctorQueryParams {
  search?: string;
  specialization?: string;
  hospital?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'name' | 'createdAt' | 'patientCount' | 'hospital';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PatientQueryParams {
  search?: string;
  condition?: string;
  status?: string;
  doctorId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'name' | 'admittedAt' | 'age' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PatientsPerDoctorPoint {
  doctorId: string;
  doctorName: string;
  specialization: string;
  hospital: string;
  patientCount: number;
  criticalCount: number;
}

export interface DateSeriesPoint {
  date: string;
  label: string;
  patients: number;
  doctors: number;
}

export interface ConditionBreakdownPoint {
  condition: string;
  count: number;
  percentage: number;
}

export interface StatusBreakdownPoint {
  status: PatientStatus;
  count: number;
}

export interface AnalyticsSummary {
  totals: {
    totalDoctors: number;
    totalPatients: number;
    avgPatientsPerDoctor: number;
    activeCriticalCases: number;
    recentPatients7d: number;
    recentDoctors30d: number;
  };
  patientsPerDoctor: PatientsPerDoctorPoint[];
  dateSeries: DateSeriesPoint[];
  conditionBreakdown: ConditionBreakdownPoint[];
  statusBreakdown: StatusBreakdownPoint[];
  facets: {
    specializations: string[];
    hospitals: string[];
    conditions: string[];
  };
}
