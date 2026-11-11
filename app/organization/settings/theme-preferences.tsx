"use client";

import { useEffect, useState } from "react";
import { applyWorkspaceThemeFromStorage } from "@/components/dashboard/workspace-theme-sync";

type ThemeMode = "light" | "dark" | "system";
type AccentKey = "blue" | "emerald" | "indigo" | "slate";

const ACCENT_OPTIONS: Array<{
  key: AccentKey;
  label: string;
  hex: string;
  swatchClass: string;
}> = [
  {
    key: "blue",
    label: "VI-Fleet Royal Blue (Default)",
    hex: "#2563eb",
    swatchClass: "bg-blue-600",
  },
  {
    key: "emerald",
    label: "Operations Emerald",
    hex: "#059669",
    swatchClass: "bg-emerald-600",
  },
  {
    key: "indigo",
    label: "Institutional Indigo",
    hex: "#4f46e5",
    swatchClass: "bg-indigo-600",
  },
  {
    key: "slate",
    label: "Executive Slate",
    hex: "#334155",
    swatchClass: "bg-slate-800",
  },
];

export default function ThemePreferences() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [accent, setAccent] = useState<AccentKey>("blue");
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">("km");
  const [currencyCode, setCurrencyCode] = useState<"ETB" | "USD">("ETB");
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("vi-fleet-theme") as ThemeMode | null;
    const savedAccent = localStorage.getItem("vi-fleet-accent") as AccentKey | null;
    const savedUnit = localStorage.getItem("vi-fleet-unit") as "km" | "mi" | null;
    const savedCurrency = localStorage.getItem("vi-fleet-currency") as
      | "ETB"
      | "USD"
      | null;

    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
      setThemeMode(savedTheme);
    }
    if (savedAccent && ACCENT_OPTIONS.some((a) => a.key === savedAccent)) {
      setAccent(savedAccent);
    }
    if (savedUnit === "km" || savedUnit === "mi") {
      setDistanceUnit(savedUnit);
    }
    if (savedCurrency === "ETB" || savedCurrency === "USD") {
      setCurrencyCode(savedCurrency);
    }
  }, []);

  function selectThemeMode(nextMode: ThemeMode) {
    setThemeMode(nextMode);
    localStorage.setItem("vi-fleet-theme", nextMode);
    applyWorkspaceThemeFromStorage();
    window.dispatchEvent(new Event("vi-fleet-theme-change"));
  }

  function selectAccent(nextAccent: AccentKey) {
    setAccent(nextAccent);
    localStorage.setItem("vi-fleet-accent", nextAccent);
    applyWorkspaceThemeFromStorage();
    window.dispatchEvent(new Event("vi-fleet-theme-change"));
  }

  function handleSavePreferences() {
    localStorage.setItem("vi-fleet-theme", themeMode);
    localStorage.setItem("vi-fleet-accent", accent);
    localStorage.setItem("vi-fleet-unit", distanceUnit);
    localStorage.setItem("vi-fleet-currency", currencyCode);

    applyWorkspaceThemeFromStorage();
    window.dispatchEvent(new Event("vi-fleet-theme-change"));

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          System Colors, Theme & Regional Preferences
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Click any theme mode or accent color to apply it immediately across
          all pages in your organization workspace.
        </p>
      </div>

      {savedNotice && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-medium text-green-800"
        >
          Workspace theme and display preferences saved across all organization pages.
        </div>
      )}

      {/* Theme Mode Selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Interface theme mode
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { id: "light", title: "Light", subtitle: "Clean Slate & White" },
              { id: "dark", title: "Dark", subtitle: "Deep Slate Contrast" },
              { id: "system", title: "System", subtitle: "Match OS setting" },
            ] as const
          ).map((item) => {
            const active = themeMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectThemeMode(item.id)}
                className={`rounded-xl border p-3.5 text-left transition ${
                  active
                    ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* System Brand Accent Colors */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          System accent color
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {ACCENT_OPTIONS.map((item) => {
            const active = accent === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => selectAccent(item.key)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span
                  className={`h-6 w-6 shrink-0 rounded-full ${item.swatchClass}`}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900">
                    {item.label}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {item.hex}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Regional & Measurement Units */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="pref-distance-unit"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Odometer & distance unit
          </label>
          <select
            id="pref-distance-unit"
            value={distanceUnit}
            onChange={(e) => setDistanceUnit(e.target.value as "km" | "mi")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="km">Kilometers (km) & Liters (L)</option>
            <option value="mi">Miles (mi) & Gallons (gal)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="pref-currency"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Reporting currency & timezone
          </label>
          <select
            id="pref-currency"
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value as "ETB" | "USD")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="ETB">ETB (Ethiopian Birr) • EAT (UTC+3)</option>
            <option value="USD">USD (US Dollar) • UTC</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={handleSavePreferences}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Apply theme & preferences
        </button>
      </div>
    </section>
  );
}
