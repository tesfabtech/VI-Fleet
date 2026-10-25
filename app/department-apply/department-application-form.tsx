"use client";

import { useActionState } from "react";
import {
  submitDepartmentApplication,
  type DepartmentApplicationState,
} from "./actions";

type DepartmentOption = {
  id: string;
  name: string;
};

type Props = {
  token: string;
  organizationName: string;
  departments: DepartmentOption[];
};

const initialState: DepartmentApplicationState = {};

export default function DepartmentApplicationForm({
  token,
  organizationName,
  departments,
}: Props) {
  const [state, action, pending] = useActionState(
    submitDepartmentApplication,
    initialState,
  );

  if (state.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6">
        <h2 className="text-lg font-semibold text-green-900">
          Application submitted
        </h2>
        <p className="mt-2 text-sm text-green-800">{state.success}</p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="token" value={token} />

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Organization
        </label>
        <input
          value={organizationName}
          readOnly
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
        />
      </div>

      <div>
        <label
          htmlFor="departmentId"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Department *
        </label>
        <select
          id="departmentId"
          name="departmentId"
          required
          defaultValue=""
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="" disabled>
            Select your department
          </option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="firstName"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Your name *
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            maxLength={150}
            autoComplete="given-name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label
            htmlFor="middleName"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Father&apos;s name *
          </label>
          <input
            id="middleName"
            name="middleName"
            required
            maxLength={150}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label
            htmlFor="lastName"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Grandfather&apos;s name *
          </label>
          <input
            id="lastName"
            name="lastName"
            required
            maxLength={150}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Email address *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={255}
            autoComplete="email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="phone"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Phone number (optional)
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          maxLength={30}
          autoComplete="tel"
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || departments.length === 0}
        className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Submitting..." : "Submit application"}
      </button>
    </form>
  );
}