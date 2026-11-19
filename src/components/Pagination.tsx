import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (nextPage: number) => void;
  onLimitChange?: (nextLimit: number) => void;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
}: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  const pages: number[] = [];
  const maxVisible = 5;
  let first = Math.max(1, page - Math.floor(maxVisible / 2));
  const last = Math.min(totalPages, first + maxVisible - 1);
  if (last - first + 1 < maxVisible) {
    first = Math.max(1, last - maxVisible + 1);
  }
  for (let p = first; p <= last; p++) {
    pages.push(p);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
      <div className="flex items-center gap-3">
        <span className="tabular-nums text-xs text-slate-500">
          Showing <strong className="font-medium text-slate-900">{start}–{end}</strong> of{' '}
          <strong className="font-medium text-slate-900">{total}</strong> records
        </span>
        {onLimitChange && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Rows</span>
            <select
              aria-label="Rows per page"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value={5}>5</option>
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={25}>25</option>
            </select>
          </label>
        )}
      </div>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Prev</span>
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2.5 text-xs font-medium tabular-nums transition-colors ${
              p === page
                ? 'bg-teal-700 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          <span>Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </nav>
    </div>
  );
}
