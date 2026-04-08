/** GET /api/settings */
export type SettingsResponseDto = {
  notification_email: string | null;
};

/** PATCH /api/settings */
export type PatchSettingsRequestBody = {
  notification_email?: string;
};
