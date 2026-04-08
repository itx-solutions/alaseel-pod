"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DriverStats } from "@/components/back-office/driver-stats";
import { StatusBadge } from "@/components/back-office/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DriverDetailView,
  DriverWithVehicleResponse,
} from "@/lib/types/driver";
import type { VehicleDto, VehiclesListResponse } from "@/lib/types/vehicle";
import { formatOrderNumber } from "@/lib/types/order";
import { cn } from "@/lib/utils";

const MAZATI = "#51836D";

function formatAssignedVehicleLine(v: {
  year: number | null;
  make: string;
  model: string;
  colour: string;
  rego: string;
}): string {
  const y = v.year != null ? `${v.year} ` : "";
  return `${y}${v.make} ${v.model} — ${v.colour} — ${v.rego}`;
}

function vehicleOptionLabel(v: VehicleDto): string {
  return `${v.make} ${v.model} — ${v.rego}`;
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-gray-200 bg-gray-100 text-gray-600",
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function DriverDetailClient({
  initial,
}: {
  initial: DriverDetailView;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [localActive, setLocalActive] = useState(initial.isActive);
  const [localPhone, setLocalPhone] = useState(initial.phone);
  const [localVehicle, setLocalVehicle] = useState(initial.vehicle);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState(initial.phone ?? "");
  const [profileSaving, setProfileSaving] = useState(false);

  const [vehiclesList, setVehiclesList] = useState<VehicleDto[]>([]);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [vehicleBusy, setVehicleBusy] = useState(false);

  useEffect(() => {
    setLocalActive(initial.isActive);
  }, [initial.isActive]);

  useEffect(() => {
    setLocalPhone(initial.phone);
    setLocalVehicle(initial.vehicle);
    if (!editProfileOpen) setPhoneInput(initial.phone ?? "");
  }, [initial.phone, initial.vehicle, editProfileOpen]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vehicles", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        const data = json as VehiclesListResponse | null;
        if (!cancelled && data?.vehicles) {
          setVehiclesList(data.vehicles.filter((v) => v.isActive));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const activeVehicleOptions = useMemo(
    () => vehiclesList.filter((v) => v.isActive),
    [vehiclesList],
  );

  async function patchDeactivate() {
    setPending(true);
    try {
      const res = await fetch(`/api/drivers/${initial.id}/deactivate`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof err.error === "string" ? err.error : `Error ${res.status}`,
        );
      }
      setLocalActive(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function patchReactivate() {
    setPending(true);
    try {
      const res = await fetch(`/api/drivers/${initial.id}/reactivate`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof err.error === "string" ? err.error : `Error ${res.status}`,
        );
      }
      setLocalActive(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function confirmDeactivate() {
    const ok = window.confirm(
      `Are you sure you want to deactivate ${initial.name}? They will no longer be able to sign in.`,
    );
    if (!ok) return;
    void patchDeactivate();
  }

  async function saveProfile() {
    setProfileSaving(true);
    try {
      const res = await fetch(`/api/drivers/${initial.id}/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneInput.trim() === "" ? null : phoneInput.trim(),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof err.error === "string" ? err.error : `Error ${res.status}`,
        );
      }
      const user = (await res.json()) as { phone: string | null };
      setLocalPhone(user.phone);
      setEditProfileOpen(false);
      router.refresh();
    } finally {
      setProfileSaving(false);
    }
  }

  async function patchVehicle(vehicleId: string | null) {
    setVehicleBusy(true);
    try {
      const res = await fetch(`/api/drivers/${initial.id}/vehicle`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof err.error === "string" ? err.error : `Error ${res.status}`,
        );
      }
      const data = (await res.json()) as DriverWithVehicleResponse;
      setLocalVehicle(data.vehicle);
      setVehiclePickerOpen(false);
      setSelectedVehicleId("");
      router.refresh();
    } finally {
      setVehicleBusy(false);
    }
  }

  const created = new Date(initial.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/drivers"
          className="text-sm font-medium text-[#51836D] hover:underline"
        >
          ← Back to Drivers
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{initial.name}</h1>
            <ActiveBadge active={localActive} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!editProfileOpen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPhoneInput(localPhone ?? "");
                setEditProfileOpen(true);
              }}
            >
              Edit profile
            </Button>
          ) : null}
          {localActive ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={confirmDeactivate}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              className="border-emerald-200 text-emerald-800 hover:bg-emerald-50"
              onClick={() => void patchReactivate()}
            >
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {editProfileOpen ? (
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-4">
          <Label htmlFor="driver-phone">Phone number</Label>
          <Input
            id="driver-phone"
            type="tel"
            className="mt-2 bg-white text-base"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={profileSaving}
              onClick={() => void saveProfile()}
              style={{ backgroundColor: MAZATI }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {profileSaving ? "Saving…" : "Save changes"}
            </button>
            <Button
              type="button"
              variant="outline"
              disabled={profileSaving}
              onClick={() => {
                setEditProfileOpen(false);
                setPhoneInput(localPhone ?? "");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Details</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Name</dt>
            <dd className="font-medium text-gray-900">{initial.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900">{initial.email}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Phone</dt>
            <dd className="font-medium text-gray-900">
              {localPhone?.trim() ? localPhone : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Account created</dt>
            <dd className="text-gray-900">{created}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd>
              <ActiveBadge active={localActive} />
            </dd>
          </div>
        </dl>

        <div className="mt-8 border-t border-gray-100 pt-6">
          <h3 className="text-sm font-semibold text-gray-900">
            Delivery performance
          </h3>
          <div className="mt-4">
            <DriverStats stats={initial.stats} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Vehicle</h2>
        <p className="mt-1 text-sm text-gray-600">
          {localVehicle
            ? formatAssignedVehicleLine(localVehicle)
            : "No vehicle assigned"}
        </p>
        {!vehiclePickerOpen ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {localVehicle ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={vehicleBusy}
                  onClick={() => {
                    setSelectedVehicleId(localVehicle.id);
                    setVehiclePickerOpen(true);
                  }}
                >
                  Change vehicle
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={vehicleBusy}
                  className="border-gray-300"
                  onClick={() => void patchVehicle(null)}
                >
                  Unassign
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={vehicleBusy}
                onClick={() => {
                  setSelectedVehicleId("");
                  setVehiclePickerOpen(true);
                }}
              >
                Assign vehicle
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>Select vehicle</Label>
              <Select
                value={selectedVehicleId || undefined}
                onValueChange={setSelectedVehicleId}
              >
                <SelectTrigger className="max-w-md bg-white">
                  <SelectValue placeholder="Choose a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {activeVehicleOptions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {vehicleOptionLabel(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={vehicleBusy || !selectedVehicleId}
                onClick={() => void patchVehicle(selectedVehicleId)}
                style={{ backgroundColor: MAZATI }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm
              </button>
              <Button
                type="button"
                variant="outline"
                disabled={vehicleBusy}
                onClick={() => {
                  setVehiclePickerOpen(false);
                  setSelectedVehicleId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Recent deliveries
        </h2>
        {initial.recentDeliveries.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-600">
            No deliveries yet
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-gray-600">Order #</TableHead>
                  <TableHead className="text-gray-600">Recipient</TableHead>
                  <TableHead className="min-w-[200px] text-gray-600">
                    Address
                  </TableHead>
                  <TableHead className="text-gray-600">Status</TableHead>
                  <TableHead className="text-gray-600">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initial.recentDeliveries.map((row) => (
                  <TableRow key={row.deliveryId}>
                    <TableCell className="font-mono text-xs font-medium">
                      <Link
                        href={`/dashboard/orders/${row.orderId}`}
                        className="text-[#51836D] hover:underline"
                      >
                        {formatOrderNumber(row.orderId)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">
                      <Link
                        href={`/dashboard/orders/${row.orderId}`}
                        className="hover:underline"
                      >
                        {row.recipientName}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[280px] text-gray-600">
                      {row.deliveryAddress.length > 64
                        ? `${row.deliveryAddress.slice(0, 64)}…`
                        : row.deliveryAddress}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-gray-600">
                      {new Date(row.displayAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
