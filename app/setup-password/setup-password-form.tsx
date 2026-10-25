
"use client";

import { useActionState } from "react";
import {
  setInitialPassword,
  type PasswordSetupState,
} from "./actions";

const initialState: PasswordSetupState = {
  success: false,
  message: "",
};

type SetupPasswordFormProps = {
  token: string;
  role:
    | "ORGANIZATION_ADMINISTRATOR"
    | "DEPARTMENT_USER"
    | "TRANSPORT_MANAGER"
    | "VICE_TRANSPORT_MANAGER"
    | "DRIVER";
  applicantDetails?: {
    firstName: string;
    middleName: string;
    lastName: string;
    email: string;
  };
};

export default function SetupPasswordForm({
  token,
  role,
  applicantDetails,
}: SetupPasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    setInitialPassword,
    initialState,
  );

  const isDepartmentUser = role === "DEPARTMENT_USER";

  const isTransportManager =
    role === "TRANSPORT_MANAGER" ||
    role === "VICE_TRANSPORT_MANAGER";

  const isDriver = role === "DRIVER";

  const usesSavedDetails =
    isDepartmentUser || isTransportManager || isDriver;

  const inputClassName =
    "w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100";

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <input type="hidden" name="token" value={token} />

      {usesSavedDetails && applicantDetails ? (
        <section
          aria-label="Your account details"
          className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">
            {isDepartmentUser
              ? "Your application details"
              : "Your account details"}
          </h2>

          <div>
            <p className="text-xs font-medium text-gray-500">
              Your name
            </p>
            <p className="mt-1 wrap-break-words text-sm text-gray-900">
              {applicantDetails.firstName}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500">
              Father&apos;s name
            </p>
            <p className="mt-1 wrap-break-words text-sm text-gray-900">
              {applicantDetails.middleName}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500">
              Grandfather&apos;s name
            </p>
            <p className="mt-1 wrap-break-words text-sm text-gray-900">
              {applicantDetails.lastName}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500">
              Login email address
            </p>
            <p className="mt-1 break-all text-sm text-gray-900">
              {applicantDetails.email}
            </p>
          </div>

          <p className="text-xs leading-5 text-gray-500">
            These details were provided by your organization.
            Contact your organization administrator if they need
            to be corrected.
          </p>
        </section>
      ) : (
        <>
          {[
            { name: "firstName", label: "Your name" },
            { name: "middleName", label: "Father's name" },
            { name: "lastName", label: "Grandfather's name" },
          ].map((field) => (
            <div key={field.name}>
              <label
                htmlFor={field.name}
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                {field.label}
              </label>

              <input
                id={field.name}
                name={field.name}
                type="text"
                autoComplete="off"
                maxLength={150}
                required
                disabled={pending || state.success}
                className={inputClassName}
              />
            </div>
          ))}

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Login email address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={255}
              required
              disabled={pending || state.success}
              className={inputClassName}
              placeholder="you@example.com"
            />

            <p className="mt-1 text-xs text-gray-500">
              Enter the email address you want to use to log in.
            </p>
          </div>
        </>
      )}

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          New password
        </label>

        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={pending || state.success}
          className={inputClassName}
        />

        <p className="mt-1 text-xs text-gray-500">
          Use at least 12 characters.
        </p>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Confirm password
        </label>

        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={pending || state.success}
          className={inputClassName}
        />
      </div>

      {state.message && (
        <p
          role={state.success ? "status" : "alert"}
          className={`rounded-lg border px-4 py-3 text-sm ${
            state.success
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      )}

      {state.verificationPath && (
        <a
          href={state.verificationPath}
          className="block break-all text-sm font-medium text-blue-700 underline"
        >
          Open development verification link
        </a>
      )}

      {!state.success && (
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? "Setting up your account..."
            : "Create password and continue"}
        </button>
      )}
    </form>
  );
}
