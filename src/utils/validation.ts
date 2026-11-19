const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DoctorFormInput {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
}

export interface PatientFormInput {
  doctorId: string;
  name: string;
  age: string | number;
  gender: string;
  phone: string;
  email: string;
  condition: string;
  status: string;
  notes?: string;
  admittedAt?: string;
}

export function validateDoctorForm(input: DoctorFormInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim() || input.name.trim().length < 2) {
    errors.name = 'Full name must be at least 2 characters.';
  }
  if (!input.specialization.trim() || input.specialization.trim().length < 2) {
    errors.specialization = 'Specialization is required.';
  }
  if (!input.hospital.trim() || input.hospital.trim().length < 2) {
    errors.hospital = 'Hospital affiliation is required.';
  }
  if (!input.phone.trim() || input.phone.trim().length < 7) {
    errors.phone = 'Valid phone number is required.';
  }
  if (!input.email.trim() || !EMAIL_RE.test(input.email.trim())) {
    errors.email = 'Valid email address is required.';
  }
  return errors;
}

export function validatePatientForm(input: PatientFormInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.doctorId.trim()) {
    errors.doctorId = 'Please assign a primary doctor.';
  }
  if (!input.name.trim() || input.name.trim().length < 2) {
    errors.name = 'Patient name must be at least 2 characters.';
  }
  const ageNum = Number(input.age);
  if (input.age === '' || !Number.isFinite(ageNum) || ageNum < 0 || ageNum > 130) {
    errors.age = 'Age must be between 0 and 130.';
  }
  if (!['Male', 'Female', 'Other'].includes(input.gender)) {
    errors.gender = 'Please select a gender.';
  }
  if (!input.phone.trim() || input.phone.trim().length < 7) {
    errors.phone = 'Valid phone number is required.';
  }
  if (!input.email.trim() || !EMAIL_RE.test(input.email.trim())) {
    errors.email = 'Valid email address is required.';
  }
  if (!input.condition.trim() || input.condition.trim().length < 2) {
    errors.condition = 'Medical condition is required.';
  }
  return errors;
}
