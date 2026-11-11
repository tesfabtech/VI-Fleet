"use client";

import { useFormStatus } from "react-dom";

export default function MaintenanceDeleteButton({
  label,
}: {
  label: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm("Move this item to the deleted records?")) {
          event.preventDefault();
        }
      }}
      className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}
