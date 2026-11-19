import React, { useEffect, useState } from 'react';
import { Mail, Phone, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { ApiError, api } from '../services/api';
import type { DoctorWithStats, PatientGender, PatientStatus, PatientWithDoctor } from '../types';
import { formatShortDate, getStatusPresentation } from '../utils/formatters';
import { validatePatientForm } from '../utils/validation';
import { ConfirmDialog } from './ConfirmDialog';

interface DoctorDetailDrawerProps {
  doctorId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

const INITIAL_PATIENT_FORM = {
  name: '',
  age: '',
  gender: 'Female' as PatientGender,
  phone: '',
  email: '',
  condition: '',
  status: 'Stable' as PatientStatus,
  notes: '',
};

export function DoctorDetailDrawer({
  doctorId,
  onClose,
  onChanged,
}: DoctorDetailDrawerProps) {
  const [doctor, setDoctor] = useState<DoctorWithStats | null>(null);
  const [patients, setPatients] = useState<PatientWithDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(INITIAL_PATIENT_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PatientWithDoctor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDetail = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.doctors.getDetail(id);
      setDoctor(res.doctor);
      setPatients(res.patients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load doctor details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!doctorId) {
      setDoctor(null);
      setPatients([]);
      setShowAddForm(false);
      return;
    }
    setShowAddForm(false);
    setForm(INITIAL_PATIENT_FORM);
    setFormErrors({});
    setSubmitError('');
    loadDetail(doctorId);
  }, [doctorId]);

  useEffect(() => {
    if (!doctorId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleteTarget) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doctorId, deleteTarget, onClose]);

  if (!doctorId) return null;

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;
    setSubmitError('');
    const errs = validatePatientForm({ ...form, doctorId: doctor.id });
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      await api.doctors.addPatient(doctor.id, {
        name: form.name,
        age: Number(form.age),
        gender: form.gender,
        phone: form.phone,
        email: form.email,
        condition: form.condition,
        status: form.status,
        notes: form.notes,
      });
      setForm(INITIAL_PATIENT_FORM);
      setShowAddForm(false);
      await loadDetail(doctor.id);
      onChanged();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to add patient.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!doctor || !deleteTarget) return;
    setDeleting(true);
    try {
      await api.doctors.deletePatient(doctor.id, deleteTarget.id);
      setDeleteTarget(null);
      await loadDetail(doctor.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove patient.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Doctor caseload details"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative h-full w-full max-w-2xl bg-white border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            {doctor ? (
              <>
                <p className="text-xs font-medium text-teal-700">
                  {doctor.specialization} · {doctor.hospital}
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold text-slate-900 truncate">
                  {doctor.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {doctor.phone}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {doctor.email}
                  </span>
                </div>
              </>
            ) : (
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Doctor Profile
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close doctor details"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : doctor ? (
            <>
              {/* Action toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Assigned Patients ({patients.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Manage patients directly under {doctor.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddForm((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
                >
                  {showAddForm ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                  <span>{showAddForm ? 'Cancel' : 'Add Patient Under Doctor'}</span>
                </button>
              </div>

              {/* Add patient inline form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddPatient}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                >
                  <h4 className="text-sm font-semibold text-slate-900">
                    New Patient for {doctor.name}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="doc-pat-name" className="block text-xs font-medium text-slate-700">
                        Patient Name
                      </label>
                      <input
                        id="doc-pat-name"
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Jane Doe"
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                      />
                      {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="doc-pat-age" className="block text-xs font-medium text-slate-700">
                          Age
                        </label>
                        <input
                          id="doc-pat-age"
                          type="number"
                          min={0}
                          max={130}
                          value={form.age}
                          onChange={(e) => setForm({ ...form, age: e.target.value })}
                          placeholder="45"
                          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                        />
                        {formErrors.age && <p className="mt-1 text-xs text-red-600">{formErrors.age}</p>}
                      </div>

                      <div>
                        <label htmlFor="doc-pat-gender" className="block text-xs font-medium text-slate-700">
                          Gender
                        </label>
                        <select
                          id="doc-pat-gender"
                          value={form.gender}
                          onChange={(e) => setForm({ ...form, gender: e.target.value as PatientGender })}
                          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                        >
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="doc-pat-phone" className="block text-xs font-medium text-slate-700">
                        Phone
                      </label>
                      <input
                        id="doc-pat-phone"
                        type="text"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+1 (415) 555-0192"
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                      />
                      {formErrors.phone && <p className="mt-1 text-xs text-red-600">{formErrors.phone}</p>}
                    </div>

                    <div>
                      <label htmlFor="doc-pat-email" className="block text-xs font-medium text-slate-700">
                        Email
                      </label>
                      <input
                        id="doc-pat-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="patient@example.com"
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                      />
                      {formErrors.email && <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>}
                    </div>

                    <div>
                      <label htmlFor="doc-pat-condition" className="block text-xs font-medium text-slate-700">
                        Medical Condition
                      </label>
                      <input
                        id="doc-pat-condition"
                        type="text"
                        value={form.condition}
                        onChange={(e) => setForm({ ...form, condition: e.target.value })}
                        placeholder="Hypertension"
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                      />
                      {formErrors.condition && <p className="mt-1 text-xs text-red-600">{formErrors.condition}</p>}
                    </div>

                    <div>
                      <label htmlFor="doc-pat-status" className="block text-xs font-medium text-slate-700">
                        Clinical Status
                      </label>
                      <select
                        id="doc-pat-status"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value as PatientStatus })}
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                      >
                        <option value="Stable">Stable</option>
                        <option value="Under Observation">Under Observation</option>
                        <option value="Critical">Critical</option>
                        <option value="Discharged">Discharged</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="doc-pat-notes" className="block text-xs font-medium text-slate-700">
                      Clinical Notes (Optional)
                    </label>
                    <input
                      id="doc-pat-notes"
                      type="text"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Initial intake observations..."
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                    />
                  </div>

                  {submitError && (
                    <p className="text-xs text-red-600">{submitError}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{saving ? 'Saving...' : 'Save Patient'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Patient list */}
              {patients.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    No patients currently assigned to {doctor.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Use the button above to assign a new patient directly to this doctor.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                  {patients.map((pat) => {
                    const statusPres = getStatusPresentation(pat.status);
                    return (
                      <div key={pat.id} className="flex items-start justify-between gap-4 p-4 hover:bg-slate-50/70">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <p className="text-sm font-semibold text-slate-900">{pat.name}</p>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs text-slate-500 tabular-nums">
                              {pat.age} yrs, {pat.gender}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className={`text-xs font-medium ${statusPres.textClass}`}>
                              {pat.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            Condition: <strong className="font-medium text-slate-800">{pat.condition}</strong>
                            {' · '}
                            <span className="font-mono tabular-nums text-slate-500">
                              Admitted {formatShortDate(pat.admittedAt)}
                            </span>
                          </p>
                          {pat.notes && (
                            <p className="mt-1 text-xs text-slate-500 line-clamp-2">{pat.notes}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(pat)}
                          aria-label={`Delete patient ${pat.name}`}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeletePatient}
        loading={deleting}
        title="Remove Patient from Doctor"
        description={
          deleteTarget
            ? `Remove ${deleteTarget.name} from ${doctor?.name ?? 'this doctor'}? This permanently deletes the patient record.`
            : ''
        }
        confirmLabel="Remove Patient"
      />
    </div>
  );
}
