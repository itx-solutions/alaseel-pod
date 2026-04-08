"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SettingsResponseDto } from "@/lib/types/settings";

const MAZATI = "#51836D";

function isValidEmailFormat(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export function SettingsClient() {
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch("/api/settings", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            typeof err.error === "string" ? err.error : `Error ${res.status}`,
          );
        }
        return res.json() as Promise<SettingsResponseDto>;
      })
      .then((data) => {
        if (cancelled) return;
        const v = data.notification_email ?? "";
        setSavedEmail(data.notification_email);
        setInput(v);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load settings",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showSuccess) return;
    const t = window.setTimeout(() => setShowSuccess(false), 3000);
    return () => window.clearTimeout(t);
  }, [showSuccess]);

  const trimmed = input.trim();
  const normalizedSaved = savedEmail ?? "";
  const dirty = trimmed !== normalizedSaved;
  const clientInvalid = trimmed !== "" && !isValidEmailFormat(trimmed);
  const canSave = dirty && !clientInvalid && !saving && !loading;

  async function onSave() {
    if (!canSave) return;
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_email: trimmed }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof err.error === "string" ? err.error : `Error ${res.status}`,
        );
      }
      const data = (await res.json()) as SettingsResponseDto;
      const next = data.notification_email ?? "";
      setSavedEmail(data.notification_email);
      setInput(next);
      setShowSuccess(true);
    } catch (e: unknown) {
      setSaveError(
        e instanceof Error ? e.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure platform settings for alaseel-pod
        </p>
      </div>

      <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure where delivery completion alerts are sent.
        </p>

        {loadError ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {loadError}
          </p>
        ) : null}

        <div className="mt-6 space-y-2">
          <Label htmlFor="notification-email" className="text-gray-900">
            Back office notification email
          </Label>
          <p className="text-sm text-gray-500">
            Delivery completion alerts will be sent to this address when a
            driver submits a POD.
          </p>
          <Input
            id="notification-email"
            type="email"
            autoComplete="email"
            placeholder="e.g. operations@mazati.au"
            className="mt-2 w-full max-w-xl bg-white text-base"
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            aria-invalid={clientInvalid}
          />
          {clientInvalid ? (
            <p className="text-sm text-red-700" role="alert">
              Enter a valid email address or leave empty to clear.
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void onSave()}
            style={{ backgroundColor: MAZATI }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {showSuccess ? (
            <span className="text-sm font-medium text-emerald-700">
              Saved successfully
            </span>
          ) : null}
          {saveError ? (
            <span className="text-sm text-red-700" role="alert">
              {saveError}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
