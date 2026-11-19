import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Pencil, RotateCcw, Search, Trash2 } from 'lucide-react';
import { ApiError, api } from '../services/api';
import type { DoctorWithStats } from '../types';
import { formatShortDate } from '../utils/formatters';
import { validateDoctorForm } from '../utils/validation';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { Pagination } from './Pagination';

interface DoctorsViewProps {
  createModalOpen: boolean;
  onCloseCreateModal: () => void;
  onInspectDoctor: (doctorId: string) => void;
  onDataChanged: () => void;
  refreshSignal: number;
}

const EMPTY_FORM = {
  name: '',
  specialization: '',
  hospital: '',
  phone: '',
  email: '',
};

export function DoctorsView({
  createModalOpen,
  onCloseCreateModal,
  onInspectDoctor,
  onDataChanged,
  refreshSignal,
}: DoctorsViewProps) {
  const [doctors, setDoctors] = useState<DoctorWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [specialization, setSpecialization] = useState('all');
  const [hospital, setHospital] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'patientCount' | 'hospital'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [facets, setFacets] = useState<{ specializations: string[]; hospitals: string[] }>({
    specializations: [],
    hospitals: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingDoctor, setEditingDoctor] = useState<DoctorWithStats | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DoctorWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, analytics] = await Promise.all([
        api.doctors.list({
          search: debouncedSearch,
          specialization,
          hospital,
          dateFrom,
          dateTo,
          sortBy,
          sortOrder,
          page,
          limit,
        }),
        api.analytics.get('30d'),
      ]);
      setDoctors(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setFacets({
        specializations: analytics.facets.specializations,
        hospitals: analytics.facets.hospitals,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load doctors.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, specialization, hospital, dateFrom, dateTo, sortBy, sortOrder, page, limit]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors, refreshSignal]);

  useEffect(() => {
    if (createModalOpen) {
      setEditingDoctor(null);
      setForm(EMPTY_FORM);
      setFormErrors({});
      setSubmitError('');
    }
  }, [createModalOpen]);

  const openEditModal = (doc: DoctorWithStats) => {
    setEditingDoctor(doc);
    setForm({
      name: doc.name,
      specialization: doc.specialization,
      hospital: doc.hospital,
      phone: doc.phone,
      email: doc.email,
    });
    setFormErrors({});
    setSubmitError('');
  };

  const closeModal = () => {
    setEditingDoctor(null);
    onCloseCreateModal();
  };

  const isModalOpen = createModalOpen || Boolean(editingDoctor);

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    const errs = validateDoctorForm(form);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      if (editingDoctor) {
        await api.doctors.update(editingDoctor.id, form);
      } else {
        await api.doctors.create(form);
      }
      closeModal();
      await fetchDoctors();
      onDataChanged();
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
        if (err.fields) setFormErrors(err.fields);
      } else {
        setSubmitError('Unable to save doctor record.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDoctor = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.doctors.delete(deleteTarget.id);
      setDeleteTarget(null);
      await fetchDoctors();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete doctor.');
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setSpecialization('all');
    setHospital('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  const hasActiveFilters =
    searchInput !== '' ||
    specialization !== 'all' ||
    hospital !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '';

  return (
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <section aria-label="Doctor filters" className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Search doctors"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, specialization, hospital, email..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by specialization"
              value={specialization}
              onChange={(e) => {
                setSpecialization(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-700 focus:outline-none"
            >
              <option value="all">All Specialties</option>
              {facets.specializations.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by hospital"
              value={hospital}
              onChange={(e) => {
                setHospital(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-700 focus:outline-none"
            >
              <option value="all">All Hospitals</option>
              {facets.hospitals.map((hosp) => (
                <option key={hosp} value={hosp}>
                  {hosp}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus-within:border-teal-700">
              <span className="text-xs font-medium text-slate-400 shrink-0">From</span>
              <input
                type="date"
                aria-label="Filter doctors from date"
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
                aria-label="Filter doctors to date"
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
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Sort by</span>
            <select
              aria-label="Sort doctors"
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(':') as [
                  'createdAt' | 'name' | 'patientCount' | 'hospital',
                  'asc' | 'desc',
                ];
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 focus:border-teal-700 focus:outline-none"
            >
              <option value="createdAt:desc">Newest Added</option>
              <option value="createdAt:asc">Oldest Added</option>
              <option value="patientCount:desc">Highest Caseload</option>
              <option value="name:asc">Name (A–Z)</option>
              <option value="hospital:asc">Hospital (A–Z)</option>
            </select>
          </div>

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
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Doctors Data Grid */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 px-5 py-3 flex items-center justify-between animate-pulse">
                <div className="h-4 w-48 rounded bg-slate-200" />
                <div className="h-4 w-32 rounded bg-slate-100" />
                <div className="h-4 w-24 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-800">No doctors match your criteria</p>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search query, specialty filter, or date range.
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
                    <th className="px-5 py-3">Doctor</th>
                    <th className="px-4 py-3">Specialization & Hospital</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3 text-right">Patients</th>
                    <th className="px-4 py-3">Added</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {doctors.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => onInspectDoctor(doc.id)}
                          className="font-medium text-slate-900 hover:text-teal-700 text-left"
                        >
                          {doc.name}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <span className="font-medium text-slate-800">{doc.specialization}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span>{doc.hospital}</span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        <div className="font-mono tabular-nums">{doc.phone}</div>
                        <div className="text-slate-500">{doc.email}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                        {doc.patientCount}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {formatShortDate(doc.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onInspectDoctor(doc.id)}
                            aria-label={`View patients for ${doc.name}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-teal-700 whitespace-nowrap"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Patients</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(doc)}
                            aria-label={`Edit ${doc.name}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(doc)}
                            aria-label={`Delete ${doc.name}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-200">
              {doctors.map((doc) => (
                <div key={doc.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => onInspectDoctor(doc.id)}
                        className="text-sm font-semibold text-slate-900 hover:text-teal-700 text-left"
                      >
                        {doc.name}
                      </button>
                      <p className="text-xs text-slate-600">
                        {doc.specialization} · {doc.hospital}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-medium text-slate-700 tabular-nums shrink-0">
                      {doc.patientCount} patients
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    <p className="font-mono tabular-nums">{doc.phone}</p>
                    <p>{doc.email}</p>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {formatShortDate(doc.createdAt)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onInspectDoctor(doc.id)}
                        className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                      >
                        Patients
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(doc)}
                        aria-label={`Edit ${doc.name}`}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(doc)}
                        aria-label={`Delete ${doc.name}`}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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

      {/* Create / Edit Doctor Modal */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingDoctor ? 'Edit Doctor Profile' : 'Add New Doctor'}
        subtitle={
          editingDoctor
            ? 'Update clinical directory details.'
            : 'Register a physician in the clinical operations directory.'
        }
      >
        <form onSubmit={handleSaveDoctor} className="space-y-4">
          <div>
            <label htmlFor="doc-name" className="block text-sm font-medium text-slate-700">
              Doctor Name
            </label>
            <input
              id="doc-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Dr. Sarah Jenkins"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            />
            {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="doc-spec" className="block text-sm font-medium text-slate-700">
                Specialization
              </label>
              <input
                id="doc-spec"
                type="text"
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                placeholder="Cardiology"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              {formErrors.specialization && (
                <p className="mt-1 text-xs text-red-600">{formErrors.specialization}</p>
              )}
            </div>

            <div>
              <label htmlFor="doc-hosp" className="block text-sm font-medium text-slate-700">
                Hospital
              </label>
              <input
                id="doc-hosp"
                type="text"
                value={form.hospital}
                onChange={(e) => setForm({ ...form, hospital: e.target.value })}
                placeholder="Metro General Hospital"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              {formErrors.hospital && (
                <p className="mt-1 text-xs text-red-600">{formErrors.hospital}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="doc-phone" className="block text-sm font-medium text-slate-700">
                Phone
              </label>
              <input
                id="doc-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (415) 890-1200"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              {formErrors.phone && <p className="mt-1 text-xs text-red-600">{formErrors.phone}</p>}
            </div>

            <div>
              <label htmlFor="doc-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="doc-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="doctor@hospital.org"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              {formErrors.email && <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>}
            </div>
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
              {saving ? 'Saving...' : editingDoctor ? 'Save Changes' : 'Create Doctor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Doctor Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteDoctor}
        loading={deleting}
        title="Delete Doctor Record"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? This will also remove their ${deleteTarget.patientCount} assigned patient record(s).`
            : ''
        }
        confirmLabel="Delete Doctor"
      />
    </div>
  );
}
