import type {
  AnalyticsSummary,
  DoctorWithStats,
  PaginatedResult,
  PatientGender,
  PatientStatus,
  PatientWithDoctor,
  PublicUser,
} from '../types';

const TOKEN_STORAGE_KEY = 'dt_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/register')) {
      setStoredToken(null);
      unauthorizedHandler?.();
    }
    throw new ApiError(
      data?.error || `Request failed with status ${res.status}`,
      res.status,
      data?.fields
    );
  }

  return data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: PublicUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (name: string, email: string, password: string) =>
      request<{ token: string; user: PublicUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      }),
    me: () => request<{ user: PublicUser }>('/api/auth/me'),
    logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  },

  analytics: {
    get: (range: '7d' | '30d' | '90d' | 'all' = '30d') =>
      request<AnalyticsSummary>(`/api/analytics?range=${encodeURIComponent(range)}`),
  },

  doctors: {
    list: (params: {
      search?: string;
      specialization?: string;
      hospital?: string;
      dateFrom?: string;
      dateTo?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    }) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== 'all') qs.set(k, String(v));
      });
      return request<PaginatedResult<DoctorWithStats>>(`/api/doctors?${qs.toString()}`);
    },
    getDetail: (id: string) =>
      request<{ doctor: DoctorWithStats; patients: PatientWithDoctor[] }>(`/api/doctors/${id}`),
    create: (payload: {
      name: string;
      specialization: string;
      hospital: string;
      phone: string;
      email: string;
    }) =>
      request<{ doctor: DoctorWithStats }>('/api/doctors', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: Partial<{
        name: string;
        specialization: string;
        hospital: string;
        phone: string;
        email: string;
      }>
    ) =>
      request<{ doctor: DoctorWithStats }>(`/api/doctors/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      request<{ deletedPatientsCount: number }>(`/api/doctors/${id}`, {
        method: 'DELETE',
      }),
    addPatient: (
      doctorId: string,
      payload: {
        name: string;
        age: number;
        gender: PatientGender;
        phone: string;
        email: string;
        condition: string;
        status: PatientStatus;
        notes?: string;
        admittedAt?: string;
      }
    ) =>
      request<{ patient: PatientWithDoctor }>(`/api/doctors/${doctorId}/patients`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    deletePatient: (doctorId: string, patientId: string) =>
      request<{ deleted: PatientWithDoctor }>(`/api/doctors/${doctorId}/patients/${patientId}`, {
        method: 'DELETE',
      }),
  },

  patients: {
    list: (params: {
      search?: string;
      condition?: string;
      status?: string;
      doctorId?: string;
      dateFrom?: string;
      dateTo?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    }) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== 'all') qs.set(k, String(v));
      });
      return request<PaginatedResult<PatientWithDoctor>>(`/api/patients?${qs.toString()}`);
    },
    create: (payload: {
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
    }) =>
      request<{ patient: PatientWithDoctor }>('/api/patients', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: Partial<{
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
    ) =>
      request<{ patient: PatientWithDoctor }>(`/api/patients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      request<{ deleted: PatientWithDoctor }>(`/api/patients/${id}`, {
        method: 'DELETE',
      }),
  },
};
