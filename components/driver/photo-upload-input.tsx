"use client";

import { useState, useRef, type ChangeEvent } from "react";
import Image from "next/image";

export function PhotoUploadInput({
  id = "evidencePhoto",
  name = "evidencePhoto",
  label = "Take or Upload Odometer Photo (Optional)",
  required = false,
  onFileSelect,
}: {
  id?: string;
  name?: string;
  label?: string;
  required?: boolean;
  onFileSelect?: (file: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSizeMb, setFileSizeMb] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) {
      clearPhoto();
      return;
    }

    // 5 MB limit
    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds maximum allowed size of 5 MB.");
      clearPhoto();
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please select a JPEG, PNG, or WEBP image.");
      clearPhoto();
      return;
    }

    setFileName(file.name);
    setFileSizeMb((file.size / 1024 / 1024).toFixed(2));
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    if (onFileSelect) onFileSelect(file);
  };

  const clearPhoto = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setFileName(null);
    setFileSizeMb(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onFileSelect) onFileSelect(null);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      {error && (
        <p className="rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-700">
          {error}
        </p>
      )}

      {previewUrl ? (
        <div className="relative flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-slate-300 bg-slate-200 shrink-0">
            <Image
              src={previewUrl}
              alt="Odometer preview"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-semibold text-slate-800 truncate">{fileName}</p>
            <p className="text-slate-500">{fileSizeMb} MB • Photo ready</p>
          </div>
          <button
            type="button"
            onClick={clearPhoto}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Retake
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-2xs hover:border-[#E6A23C] hover:bg-slate-50 active:scale-[0.99] cursor-pointer"
          >
            <svg
              className="h-4 w-4 text-[#245B85]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>Take Camera Photo / Choose File</span>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        id={id}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
