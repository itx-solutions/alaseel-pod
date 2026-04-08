/** Single vehicle row for API and UI */
export type VehicleDto = {
  id: string;
  make: string;
  model: string;
  colour: string;
  rego: string;
  year: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

export type VehiclesListResponse = {
  vehicles: VehicleDto[];
};

export type PostVehicleBody = {
  make: string;
  model: string;
  colour: string;
  rego: string;
  year?: number | null;
  notes?: string | null;
};

export type PatchVehicleBody = {
  make?: string;
  model?: string;
  colour?: string;
  rego?: string;
  year?: number | null;
  notes?: string | null;
};
