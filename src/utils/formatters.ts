import type { PatientStatus } from '../types';

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function toInputDate(iso: string): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function getStatusPresentation(status: PatientStatus): {
  label: string;
  textClass: string;
  dotClass: string;
} {
  switch (status) {
    case 'Stable':
      return {
        label: 'Stable',
        textClass: 'text-emerald-700',
        dotClass: 'bg-emerald-600',
      };
    case 'Under Observation':
      return {
        label: 'Observation',
        textClass: 'text-amber-700',
        dotClass: 'bg-amber-500',
      };
    case 'Critical':
      return {
        label: 'Critical',
        textClass: 'text-red-700',
        dotClass: 'bg-red-600',
      };
    case 'Discharged':
      return {
        label: 'Discharged',
        textClass: 'text-slate-600',
        dotClass: 'bg-slate-400',
      };
  }
}

export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
