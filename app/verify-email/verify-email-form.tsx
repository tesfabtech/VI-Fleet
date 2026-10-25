"use client";

import { useActionState } from "react";
import {
  verifyAccountEmail,
  type VerifyEmailState,
} from "./actions";

const initialState: VerifyEmailState = {
  success: false,
  message: "",
};

export default function VerifyEmailForm({
  token,
}: {
  token: string;
}) {
  const [state, formAction, pending] = useActionState(
    verifyAccountEmail,
    initialState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.message && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {pending ? "Verifying..." : "Verify email and activate account"}
      </button>
    </form>
  );
}