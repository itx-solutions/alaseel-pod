"use client";

import { useEffect, useState } from "react";
import type { DriverOwnProfileResponse } from "@/lib/types/driver";

export function DriverProfileClient() {
  const [data, setData] = useState<DriverOwnProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/driver/profile", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            typeof err.error === "string" ? err.error : `Error ${res.status}`,
          );
        }
        return res.json() as Promise<DriverOwnProfileResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load profile");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-red-700" role="alert">
        {error ?? "Unable to load profile."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-base font-semibold text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">{data.email}</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Details</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Phone</dt>
            <dd className="text-right font-medium text-gray-900">
              {data.phone?.trim() ? data.phone : "Not set"}
            </dd>
          </div>
        </dl>
      </div>

      {data.vehicle ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">My Vehicle</h2>
          <p className="mt-2 font-bold text-gray-900">
            {data.vehicle.make} {data.vehicle.model}
          </p>
          <dl className="mt-3 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Rego</dt>
              <dd className="font-mono font-medium tabular-nums text-gray-900">
                {data.vehicle.rego}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Colour</dt>
              <dd>{data.vehicle.colour}</dd>
            </div>
            {data.vehicle.year != null ? (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Year</dt>
                <dd className="tabular-nums">{data.vehicle.year}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          No vehicle assigned — contact your administrator.
        </p>
      )}

      <p className="text-sm text-gray-500">
        To update your details, contact your administrator.
      </p>
    </div>
  );
}
