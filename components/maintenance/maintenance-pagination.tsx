import Link from "next/link";

export default function MaintenancePagination({
  action,
  page,
  pageCount,
  values,
}: {
  action: string;
  page: number;
  pageCount: number;
  values: Record<string, string>;
}) {
  if (pageCount <= 1) return null;

  function pageHref(targetPage: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value) query.set(key, value);
    }
    query.set("page", String(targetPage));
    return `${action}?${query.toString()}`;
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between">
      <p className="text-sm text-slate-500">
        Page {page} of {pageCount}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={pageHref(page - 1)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            Previous
          </Link>
        )}
        {page < pageCount && (
          <Link
            href={pageHref(page + 1)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}
