"use client";

import { useEffect, useMemo, useState } from "react";
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { VehicleDto, VehiclesListResponse } from "@/lib/types/vehicle";
import { cn } from "@/lib/utils";

const MAZATI = "#51836D";

function truncateNotes(s: string | null, max: number): string {
  if (!s || !s.trim()) return "—";
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function StatusBadge({ active }: { active: boolean }) {
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

function maxVehicleYear(): number {
  return new Date().getFullYear() + 1;
}

function validateYearString(
  raw: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: null };
  const n = Number.parseInt(t, 10);
  const maxY = maxVehicleYear();
  if (!Number.isInteger(n) || n < 1990 || n > maxY) {
    return {
      ok: false,
      message: `Year must be between 1990 and ${maxY}`,
    };
  }
  return { ok: true, value: n };
}

function emptyFieldErrors(
  make: string,
  model: string,
  colour: string,
  rego: string,
): Partial<Record<"make" | "model" | "colour" | "rego", string>> {
  const e: Partial<Record<"make" | "model" | "colour" | "rego", string>> = {};
  if (!make.trim()) e.make = "Required";
  if (!model.trim()) e.model = "Required";
  if (!colour.trim()) e.colour = "Required";
  if (!rego.trim()) e.rego = "Required";
  return e;
}

export function VehiclesClient() {
  const [data, setData] = useState<VehiclesListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [search, setSearch] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleDto | null>(null);
  const [saving, setSaving] = useState(false);

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [colour, setColour] = useState("");
  const [rego, setRego] = useState("");
  const [year, setYear] = useState("");
  const [notes, setNotes] = useState("");

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"make" | "model" | "colour" | "rego" | "year", string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/vehicles", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            typeof err.error === "string" ? err.error : `Error ${res.status}`,
          );
        }
        return res.json() as Promise<VehiclesListResponse>;
      })
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load vehicles");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setMake("");
    setModel("");
    setColour("");
    setRego("");
    setYear("");
    setNotes("");
    setFieldErrors({});
    setFormError(null);
    setSheetOpen(true);
  }

  function openEdit(v: VehicleDto) {
    setEditing(v);
    setMake(v.make);
    setModel(v.model);
    setColour(v.colour);
    setRego(v.rego);
    setYear(v.year != null ? String(v.year) : "");
    setNotes(v.notes ?? "");
    setFieldErrors({});
    setFormError(null);
    setSheetOpen(true);
  }

  function closeSheet(open: boolean) {
    setSheetOpen(open);
    if (!open) {
      setEditing(null);
      setFieldErrors({});
      setFormError(null);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.vehicles.filter((v) => {
      if (statusFilter === "active" && !v.isActive) return false;
      if (statusFilter === "inactive" && v.isActive) return false;
      if (!q) return true;
      return (
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.rego.toLowerCase().includes(q)
      );
    });
  }, [data, statusFilter, search]);

  async function submitForm() {
    setFormError(null);
    const fe = emptyFieldErrors(make, model, colour, rego);
    const yv = validateYearString(year);
    const next: typeof fieldErrors = { ...fe };
    if (!yv.ok) next.year = yv.message;
    setFieldErrors(next);
    if (Object.keys(fe).length > 0 || !yv.ok) return;

    const yearVal = yv.ok ? yv.value : null;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/vehicles/${editing.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            make: make.trim(),
            model: model.trim(),
            colour: colour.trim(),
            rego: rego.trim(),
            year: yearVal,
            notes: notes.trim() || null,
          }),
        });
        if (res.status === 409) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          setFormError(
            typeof err.error === "string"
              ? err.error
              : "This registration is already in use",
          );
          setFieldErrors((prev) => ({
            ...prev,
            rego: "Registration already exists",
          }));
          return;
        }
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            typeof err.error === "string" ? err.error : `Error ${res.status}`,
          );
        }
      } else {
        const res = await fetch("/api/vehicles", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            make: make.trim(),
            model: model.trim(),
            colour: colour.trim(),
            rego: rego.trim(),
            year: yearVal,
            notes: notes.trim() || null,
          }),
        });
        if (res.status === 409) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          setFormError(
            typeof err.error === "string"
              ? err.error
              : "This registration is already in use",
          );
          setFieldErrors((prev) => ({
            ...prev,
            rego: "Registration already exists",
          }));
          return;
        }
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            typeof err.error === "string" ? err.error : `Error ${res.status}`,
          );
        }
      }
      closeSheet(false);
      load();
    } catch (e: unknown) {
      setFormError(
        e instanceof Error ? e.message : "Could not save vehicle",
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDeactivate(v: VehicleDto) {
    const ok = window.confirm(
      `Are you sure you want to deactivate ${v.rego}?`,
    );
    if (!ok) return;
    void fetch(`/api/vehicles/${v.id}/deactivate`, {
      method: "PATCH",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to deactivate");
      })
      .then(() => load())
      .catch(() => setError("Failed to deactivate vehicle"));
  }

  async function reactivate(id: string) {
    const res = await fetch(`/api/vehicles/${id}/reactivate`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) {
      setError("Failed to reactivate vehicle");
      return;
    }
    load();
  }

  const emptyAll = !loading && data && data.vehicles.length === 0;
  const emptyFiltered =
    !loading && data && data.vehicles.length > 0 && filtered.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage the company fleet
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          style={{ backgroundColor: MAZATI }}
          className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Add vehicle
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-2 sm:w-48">
          <Label htmlFor="veh-status">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="veh-status" className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[200px] flex-1 space-y-2">
          <Label htmlFor="veh-search">Search</Label>
          <Input
            id="veh-search"
            className="bg-white text-base"
            placeholder="Make, model, or rego"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-6">
          <div className="h-6 w-1/3 animate-pulse rounded bg-gray-200" />
          <div className="h-32 animate-pulse rounded bg-gray-100" />
        </div>
      ) : emptyAll ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-600">
          No vehicles found. Add your first vehicle to get started.
        </p>
      ) : emptyFiltered ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-600">
          No vehicles match your filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-gray-600">Vehicle</TableHead>
                <TableHead className="text-gray-600">Rego</TableHead>
                <TableHead className="text-gray-600">Colour</TableHead>
                <TableHead className="text-gray-600">Status</TableHead>
                <TableHead className="text-gray-600">Notes</TableHead>
                <TableHead className="text-right text-gray-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow
                  key={v.id}
                  className={cn(!v.isActive && "opacity-50")}
                >
                  <TableCell>
                    <p className="font-semibold text-gray-900">
                      {v.make} {v.model}
                    </p>
                    {v.year != null ? (
                      <p className="text-sm text-gray-500">{v.year}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm font-medium tabular-nums text-gray-900">
                      {v.rego}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-700">{v.colour}</TableCell>
                  <TableCell>
                    <StatusBadge active={v.isActive} />
                  </TableCell>
                  <TableCell className="max-w-[200px] text-gray-600">
                    {truncateNotes(v.notes, 60)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(v)}
                      >
                        Edit
                      </Button>
                      {v.isActive ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => confirmDeactivate(v)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                          onClick={() => void reactivate(v.id)}
                        >
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={closeSheet}>
        <SheetContent
          side="right"
          className="flex w-full flex-col overflow-y-auto border-gray-200 bg-white p-0 sm:max-w-md"
          showCloseButton
        >
          <SheetHeader className="border-b border-gray-200 px-6 py-4 text-left">
            <SheetTitle className="text-lg text-gray-900">
              {editing ? "Edit vehicle" : "Add vehicle"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-6 py-4">
            {formError ? (
              <p className="text-sm text-red-700" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="v-make">Make</Label>
              <Input
                id="v-make"
                className="bg-white text-base"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                aria-invalid={!!fieldErrors.make}
              />
              {fieldErrors.make ? (
                <p className="text-sm text-red-700">{fieldErrors.make}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-model">Model</Label>
              <Input
                id="v-model"
                className="bg-white text-base"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                aria-invalid={!!fieldErrors.model}
              />
              {fieldErrors.model ? (
                <p className="text-sm text-red-700">{fieldErrors.model}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-colour">Colour</Label>
              <Input
                id="v-colour"
                className="bg-white text-base"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                aria-invalid={!!fieldErrors.colour}
              />
              {fieldErrors.colour ? (
                <p className="text-sm text-red-700">{fieldErrors.colour}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-rego">Rego</Label>
              <Input
                id="v-rego"
                className="bg-white font-mono text-base"
                value={rego}
                onChange={(e) => setRego(e.target.value.toUpperCase())}
                aria-invalid={!!fieldErrors.rego}
              />
              {fieldErrors.rego ? (
                <p className="text-sm text-red-700">{fieldErrors.rego}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-year">Year (optional)</Label>
              <Input
                id="v-year"
                inputMode="numeric"
                className="bg-white text-base"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                aria-invalid={!!fieldErrors.year}
              />
              {fieldErrors.year ? (
                <p className="text-sm text-red-700">{fieldErrors.year}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-notes">Notes (optional)</Label>
              <Textarea
                id="v-notes"
                className="min-h-[100px] bg-white text-base"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="border-t border-gray-200 bg-gray-50">
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-gray-300"
                onClick={() => closeSheet(false)}
              >
                Cancel
              </Button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitForm()}
                style={{ backgroundColor: MAZATI }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
