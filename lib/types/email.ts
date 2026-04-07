export type EmailQueueEntryStatus =
  | "pending_review"
  | "approved"
  | "rejected";

export type ParsedEmailConfidence = "high" | "medium" | "low";

/** Stored in email_queue.parsed_data (Claude output + optional internal keys). */
export interface ParsedEmailData {
  recipient_name: string | null;
  delivery_address: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  items: Array<{ name: string; quantity: number }> | null;
  special_instructions: string | null;
  confidence: ParsedEmailConfidence;
  /** Set after approve when order is created (not from Claude). */
  _created_order_id?: string;
}

export type EmailQueueListRowDto = {
  id: string;
  raw_from: string;
  raw_subject: string;
  created_at: string;
  confidence: ParsedEmailConfidence | null;
  status: EmailQueueEntryStatus;
};

export type PaginatedEmailQueueResponse = {
  items: EmailQueueListRowDto[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type EmailQueueDetailDto = {
  id: string;
  raw_from: string;
  raw_subject: string;
  raw_body: string;
  parsed_data: ParsedEmailData | null;
  status: EmailQueueEntryStatus;
  reviewed_at: string | null;
  reviewer_name: string | null;
  created_at: string;
};

/** POST /api/email-queue/[id]/approve — optional overrides (snake_case). */
export type PostEmailQueueApproveBody = {
  recipient_name?: string;
  delivery_address?: string;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  items?: Array<{ name: string; quantity: number }>;
  special_instructions?: string | null;
};
