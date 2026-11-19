import React, { useCallback, useEffect, useState } from 'react';
import { Download, Pencil, RotateCcw, Search, Trash2 } from 'lucide-react';
import { ApiError, api } from '../services/api';
import type {
  DoctorWithStats,
  PatientGender,
  PatientStatus,
  PatientWithDoctor,
} from '../types';
import {
  exportRowsToCsv,
  formatShortDate,
  getStatusPresentation,
  toInputDate,
} from '../utils/formatters';
import { validatePatientForm } from '../utils/validation';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { Pagination } from './Pagination';

interface PatientsViewProps {
  createModalOpen: boolean;
  onCloseCreateModal: () => void;
  onInspectDoctor: (doctorId: string) => void;
  onDataChanged: () => void;
  refreshSignal: number;
}

const EMPTY_FORM = {
  doctorId: '',
  name: '',
  age: '',
  gender: 'Female' as PatientGender,
  phone: '',
  email: '',
  condition: '',
  status: 'Stable' as PatientStatus,
  notes: '',
  admittedAt: '',
};

export function PatientsView({
  createModalOpen,
  onCloseCreateModal,
  onInspectDoctor,
  onDataChanged,
  refreshSignal,
}: PatientsViewProps) {
  const [patients, setPatients] = useState<PatientWithDoctor[]>([]);
  const [doctorsList, setDoctorsList] = useState<DoctorWithStats[]>([]);
  const [conditionsFacet, setConditionsFacet] = useState<string[]>([]);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [condition, setCondition] = useState('all');
  const [status, setStatus] = useState('all');
  const [doctorId, setDoctorId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'admittedAt' | 'name' | 'age'>('admittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingPatient, setEditingPatient] = useState<PatientWithDoctor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PatientWithDoctor | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, docsRes, analytics] = await Promise.all([
        api.patients.list({
          search: debouncedSearch,
          condition,
          status,
          doctorId,
          dateFrom,
          dateTo,
          sortBy,
          sortOrder,
          page,
          limit,
        }),
        api.doctors.list({ limit: 100, sortBy: 'name', sortOrder: 'asc' }),
        api.analytics.get('30d'),
      ]);
      setPatients(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setDoctorsList(docsRes.items);
      setConditionsFacet(analytics.facets.conditions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load patients.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, condition, status, doctorId, dateFrom, dateTo, sortBy, sortOrder, page, limit]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients, refreshSignal]);

  useEffect(() => {
    if (createModalOpen) {
      setEditingPatient(null);
      setForm({
        ...EMPTY_FORM,
        doctorId: doctorsList[0]?.id ?? '',
        admittedAt: new Date().toISOString().slice(0, 10),
      });
      setFormErrors({});
      setSubmitError('');
    }
  }, [createModalOpen, doctorsList]);

  const openEditModal = (pat: PatientWithDoctor) => {
    setEditingPatient(pat);
    setForm({
      doctorId: pat.doctorId,
      name: pat.name,
      age: String(pat.age),
      gender: pat.gender,
      phone: pat.phone,
      email: pat.email,
      condition: pat.condition,
      status: pat.status,
      notes: pat.notes,
      admittedAt: toInputDate(pat.admittedAt),
    });
    setFormErrors({});
    setSubmitError('');
  };

  const closeModal = () => {
    setEditingPatient(null);
    onCloseCreateModal();
  };

  const isModalOpen = createModalOpen || Boolean(editingPatient);

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    const errs = validatePatientForm(form);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        doctorId: form.doctorId,
        name: form.name,
        age: Number(form.age),
        gender: form.gender,
        phone: form.phone,
        email: form.email,
        condition: form.condition,
        status: form.status,
        notes: form.notes,
        admittedAt: form.admittedAt || undefined,
      };
      if (editingPatient) {
        await api.patients.update(editingPatient.id, payload);
      } else {
        await api.patients.create(payload);
      }
      closeModal();
      await fetchPatients();
      onDataChanged();
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
        if (err.fields) setFormErrors(err.fields);
      } else {
        setSubmitError('Unable to save patient record.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.patients.delete(deleteTarget.id);
      setDeleteTarget(null);
      await fetchPatients();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete patient.');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      'doctor-tracker-patients.csv',
      ['Name', 'Age', 'Gender', 'Condition', 'Status', 'Doctor', 'Hospital', 'Phone', 'Email', 'Admitted'],
      patients.map((p) => [
        p.name,
        p.age,
        p.gender,
        p.condition,
        p.status,
        p.doctorName,
        p.doctorHospital,
        p.phone,
        p.email,
        p.admittedAt.slice(0, 10),
      ])
    );
  };

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setCondition('all');
    setStatus('all');
    setDoctorId('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('admittedAt');
    setSortOrder('desc');
    setPage(1);
  };

  const hasActiveFilters =
    searchInput !== '' ||
    condition !== 'all' ||
    status !== 'all' ||
    doctorId !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '';

  return (
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <section aria-label="Patient filters" className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Search patients"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search patient, condition, doctor, email..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by condition"
              value={condition}
              onChange={(e) => {
                setCondition(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-700 focus:outline-none"
            >
              <option value="all">All Conditions</option>
              {conditionsFacet.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-700 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Stable">Stable</option>
              <option value="Under Observation">Under Observation</option>
              <option value="Critical">Critical</option>
              <option value="Discharged">Discharged</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus-within:border-teal-700">
              <span className="text-xs font-medium text-slate-400 shrink-0">From</span>
              <input
                type="date"
                aria-label="Filter patients from date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full min-w-0 bg-transparent text-xs sm:text-sm text-slate-700 focus:outline-none"
              />
            </label>
          </div>

          <div className="lg:col-span-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus-within:border-teal-700">
              <span className="text-xs font-medium text-slate-400 shrink-0">To</span>
              <input
                type="date"
                aria-label="Filter patients to date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full min-w-0 bg-transparent text-xs sm:text-sm text-slate-700 focus:outline-none"
              />
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Filter by assigned doctor"
              value={doctorId}
              onChange={(e) => {
                setDoctorId(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 focus:border-teal-700 focus:outline-none"
            >
              <option value="all">All Doctors</option>
              {doctorsList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Sort</span>
              <select
                aria-label="Sort patients"
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [sb, so] = e.target.value.split(':') as [
                    'admittedAt' | 'name' | 'age',
                    'asc' | 'desc',
                  ];
                  setSortBy(sb);
                  setSortOrder(so);
                  setPage(1);
                }}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 focus:border-teal-700 focus:outline-none"
              >
                <option value="admittedAt:desc">Newest Admitted</option>
                <option value="admittedAt:asc">Oldest Admitted</option>
                <option value="name:asc">Name (A–Z)</option>
                <option value="age:desc">Age (High–Low)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={patients.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Patients Data Grid */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 px-5 py-3 flex items-center justify-between animate-pulse">
                <div className="h-4 w-44 rounded bg-slate-200" />
                <div className="h-4 w-36 rounded bg-slate-100" />
                <div className="h-4 w-24 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-800">No patients match your filters</p>
            <p className="mt-1 text-xs text-slate-500">
              Adjust your search terms, condition filter, or admission date window.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="px-5 py-3">Patient</th>
                    <th className="px-4 py-3">Condition & Status</th>
                    <th className="px-4 py-3">Assigned Doctor</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Admitted</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {patients.map((pat) => {
                    const statusPres = getStatusPresentation(pat.status);
                    return (
                      <tr key={pat.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-900">{pat.name}</div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {pat.age} yrs · {pat.gender}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800">{pat.condition}</div>
                          <div className={`text-xs font-medium ${statusPres.textClass}`}>
                            {pat.status}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => onInspectDoctor(pat.doctorId)}
                            className="font-medium text-teal-800 hover:underline text-left"
                          >
                            {pat.doctorName}
                          </button>
                          <div className="text-xs text-slate-500">
                            {pat.doctorSpecialization} · {pat.doctorHospital}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          <div className="font-mono tabular-nums">{pat.phone}</div>
                          <div className="text-slate-500">{pat.email}</div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                          {formatShortDate(pat.admittedAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(pat)}
                              aria-label={`Edit patient ${pat.name}`}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(pat)}
                              aria-label={`Delete patient ${pat.name}`}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-200">
              {patients.map((pat) => {
                const statusPres = getStatusPresentation(pat.status);
                return (
                  <div key={pat.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{pat.name}</p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {pat.age} yrs · {pat.gender}
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${statusPres.textClass} shrink-0`}>
                        {pat.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">
                      {pat.condition} ·{' '}
                      <button
                        type="button"
                        onClick={() => onInspectDoctor(pat.doctorId)}
                        className="font-medium text-teal-800 underline"
                      >
                        {pat.doctorName}
                      </button>
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {formatShortDate(pat.admittedAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(pat)}
                          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(pat)}
                          aria-label={`Delete patient ${pat.name}`}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
        />
      </section>

      {/* Create / Edit Patient Modal */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingPatient ? 'Edit Patient Record' : 'Add New Patient'}
        subtitle={
          editingPatient
            ? 'Modify patient details, clinical condition, or doctor assignment.'
            : 'Register a new patient and assign them to an attending physician.'
        }
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSavePatient} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pat-name" className="block text-sm font-medium text-slate-700">
                Patient Name
              </label>
              <input
                id="pat-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Liam Carter"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="pat-doctor" className="block text-sm font-medium text-slate-700">
                Assigned Doctor
              </label>
              <select
                id="pat-doctor"
                value={form.doctorId}
                onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                <option value="">Select a doctor</option>
                {doctorsList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.specialization})
                  </option>
                ))}
              </select>
              {formErrors.doctorId && <p className="mt-1 text-xs text-red-600">{formErrors.doctorId}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pat-age" className="block text-sm font-medium text-slate-700">
                  Age
                </label>
                <input
                  id="pat-age"
                  type="number"
                  min={0}
                  max={130}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  placeholder="48"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
                {formErrors.age && <p className="mt-1 text-xs text-red-600">{formErrors.age}</p>}
              </div>

              <div>
                <label htmlFor="pat-gender" className="block text-sm font-medium text-slate-700">
                  Gender
                </label>
                <select
                  id="pat-gender"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as PatientGender })}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="pat-admitted" className="block text-sm font-medium text-slate-700">
                Admission Date
              </label>
              <input
                id="pat-admitted"
                type="date"
                value={form.admittedAt}
                onChange={(e) => setForm({ ...form, admittedAt: e.target.value })}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="pat-condition" className="block text-sm font-medium text-slate-700">
                Medical Condition
              </label>
              <input
                id="pat-condition"
                type="text"
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                placeholder="Hypertension"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              {formErrors.condition && <p className="mt-1 text-xs text-red-600">{formErrors.condition}</p>}
            </div>

            <div>
              <label htmlFor="pat-status" className="block text-sm font-medium text-slate-700">
                Clinical Status
              </label>
              <select
                id="pat-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as PatientStatus })}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                <option value="Stable">Stable</option>
                <option value="Under Observation">Under Observation</option>
                <option value="Critical">Critical</option>
                <option value="Discharged">Discharged</option>
              </select>
            </div>

            <div>
              <label htmlFor="pat-phone" className="block text-sm font-medium text-slate-700">
                Phone
              </label>
              <input
                id="pat-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (415) 301-1180"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              {formErrors.phone && <p className="mt-1 text-xs text-red-600">{formErrors.phone}</p>}
            </div>

            <div>
              <label htmlFor="pat-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="pat-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="patient@example.com"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              {formErrors.email && <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="pat-notes" className="block text-sm font-medium text-slate-700">
              Clinical Notes
            </label>
            <textarea
              id="pat-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Treatment summary or monitoring instructions..."
              className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>

          {submitError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingPatient ? 'Save Changes' : 'Create Patient'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Patient Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeletePatient}
        loading={deleting}
        title="Delete Patient Record"
        description={
          deleteTarget
            ? `Permanently delete ${deleteTarget.name} (${deleteTarget.condition}) from the patient registry?`
            : ''
        }
        confirmLabel="Delete Patient"
      />
    </div>
  );
}
