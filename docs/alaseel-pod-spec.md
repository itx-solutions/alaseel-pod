# alaseel-pod — Full Project Specification

## Overview

Build a web-based Proof of Delivery (POD) platform called **alaseel-pod**. This platform is used by a small-to-medium business that operates its own delivery fleet across metro areas. The business has a back office team who manage delivery orders and a team of 6–20 drivers who use the platform on their phones or iPads to capture proof of delivery in the field.

The platform has two distinct interfaces:
- A **back office web UI** for managing orders, assigning drivers, and viewing POD records
- A **driver-facing Progressive Web App (PWA)** optimised for mobile/iPad use in the field

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Cloudflare Workers |
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Neon Postgres |
| Connection Pooling | Cloudflare Hyperdrive |
| ORM | Drizzle ORM |
| Authentication | Clerk |
| File Storage | Cloudflare R2 |
| Icons | Lucide React |
| Deployment | OpenNext on Cloudflare |
| Font | Inter (Google Fonts) |

---

## User Roles

### Back Office User
- Creates, edits, and manages delivery orders
- Assigns orders to drivers
- Views all delivery statuses in real time
- Views completed POD records (signature, photos, timestamp, GPS)
- Receives email notifications when deliveries are completed
- Manages the driver list

### Driver
- Logs in and sees only their assigned deliveries for the day
- Navigates to delivery addresses
- Captures proof of delivery: signature + receiver name, or photo-only for unattended deliveries
- Marks deliveries as completed or attempted (no one home)
- Works offline if signal is lost — syncs when reconnected

---

## Database Schema

Use Drizzle ORM with Neon Postgres. Migrations must be committed to the repo under `db/migrations/`. Configure `drizzle.config.ts` to output migrations to `db/migrations`.

### Tables

#### `users`
Managed by Clerk. Store a local reference only.
- `id` (uuid, PK)
- `clerk_id` (text, unique)
- `role` (enum: `back_office`, `driver`)
- `name` (text)
- `email` (text)
- `is_active` (boolean, default true)
- `created_at` (timestamp)

#### `orders`
The source order before it becomes a delivery job.
- `id` (uuid, PK)
- `source` (enum: `manual`, `shopify`, `email`)
- `shopify_order_id` (text, nullable — for Shopify-sourced orders)
- `shopify_order_number` (text, nullable)
- `recipient_name` (text)
- `recipient_phone` (text, nullable)
- `recipient_email` (text, nullable)
- `delivery_address` (text)
- `delivery_address_lat` (decimal, nullable)
- `delivery_address_lng` (decimal, nullable)
- `items` (jsonb — array of `{ name: string, quantity: number, notes?: string }`)
- `special_instructions` (text, nullable)
- `status` (enum: `pending`, `assigned`, `in_transit`, `completed`, `attempted`)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `deliveries`
A delivery job linking an order to a driver.
- `id` (uuid, PK)
- `order_id` (uuid, FK → orders)
- `driver_id` (uuid, FK → users)
- `assigned_at` (timestamp)
- `started_at` (timestamp, nullable — when driver marks "on the way")
- `arrived_at` (timestamp, nullable — when driver marks "arrived")
- `completed_at` (timestamp, nullable)
- `status` (enum: `assigned`, `in_transit`, `completed`, `attempted`)
- `notes` (text, nullable — driver notes added at completion)

#### `pods`
The proof of delivery record. Immutable after creation — no updates allowed, only add notes via a separate `pod_notes` table if needed.
- `id` (uuid, PK)
- `delivery_id` (uuid, FK → deliveries)
- `pod_type` (enum: `signed`, `unattended`)
- `receiver_name` (text, nullable — typed by driver for signed deliveries)
- `signature_url` (text, nullable — R2 URL for signature image)
- `gps_lat` (decimal, nullable — captured at time of POD submission)
- `gps_lng` (decimal, nullable)
- `submitted_at` (timestamp)

#### `pod_photos`
One or more photos attached to a POD.
- `id` (uuid, PK)
- `pod_id` (uuid, FK → pods)
- `photo_url` (text — R2 URL)
- `uploaded_at` (timestamp)

#### `email_queue`
Inbound emails awaiting parsing and review.
- `id` (uuid, PK)
- `raw_from` (text)
- `raw_subject` (text)
- `raw_body` (text)
- `parsed_data` (jsonb, nullable — extracted fields after parsing)
- `status` (enum: `pending_review`, `approved`, `rejected`)
- `created_at` (timestamp)
- `reviewed_at` (timestamp, nullable)
- `reviewed_by` (uuid, FK → users, nullable)

---

## Authentication & Authorisation

Use **Clerk** for authentication.

- Two roles: `back_office` and `driver`
- Role is stored in Clerk's public metadata and mirrored in the local `users` table
- Back office routes: protected, role = `back_office`
- Driver routes: protected, role = `driver`
- Use Clerk middleware in Next.js to protect all `/dashboard/*` and `/driver/*` routes
- Redirect unauthenticated users to `/sign-in`
- After sign-in, redirect based on role: back office → `/dashboard`, driver → `/driver`

---

## Back Office — Feature Requirements

### Layout
- Persistent sidebar navigation
- Responsive — works on desktop and tablet
- Navigation items: Dashboard, Orders, Drivers, POD Records, Email Queue, Settings

### Dashboard (`/dashboard`)
- Stats cards: Total orders today, Completed today, In transit, Pending assignment
- List of today's deliveries with live status
- Quick-assign unassigned orders from the dashboard

### Orders (`/dashboard/orders`)
- Table view of all orders with columns: Order #, Recipient, Address, Items (count), Status, Driver, Date
- Filters: status, driver, date range, source (manual/shopify/email)
- Search: by recipient name, address, order number
- Pagination

#### Create Order (`/dashboard/orders/new`)
Form fields:
- Recipient name (required)
- Recipient phone
- Recipient email
- Delivery address (required) — use a geocoding-capable address input (Google Places or similar)
- Items being delivered — repeatable field: item name + quantity + optional notes
- Special instructions
- Assign to driver (optional at creation)

#### Order Detail (`/dashboard/orders/[id]`)
- All order fields displayed
- Status timeline (created → assigned → in transit → completed/attempted)
- Driver assigned
- Link to POD record if completed
- Edit button (only available while status is `pending` or `assigned`)
- Notes field

#### Assign Driver
- Dropdown on order detail to assign or reassign a driver
- Changing assignment sends the order to the new driver's queue

### Drivers (`/dashboard/drivers`)
- List of all active drivers: name, email, deliveries today, status
- Add new driver (creates a Clerk invite + user record with role `driver`)
- Deactivate driver

### POD Records (`/dashboard/pods`)
- Table of all completed PODs: date, driver, recipient, address, type (signed/unattended)
- Click to open POD detail
- POD detail shows: signature image, all photos, receiver name, GPS coordinates (map embed), timestamp, driver name, delivery address
- POD records are read-only — no editing
- Download POD as PDF (signature + photos + delivery details on one page)

### Email Queue (`/dashboard/email-queue`)
- List of inbound emails awaiting review
- Each row shows: from address, subject, received time, parse status
- Click to open review panel: shows raw email on the left, parsed fields on the right
- Back office user can edit parsed fields before approving
- Approve → creates an order from the parsed data
- Reject → marks the email as rejected with an optional reason

---

## Driver App — Feature Requirements

The driver app must be a PWA (Progressive Web App) with offline support. It must be optimised for one-handed use on a phone. Large tap targets, minimal text input, no complex navigation.

### Layout
- Full-height mobile layout
- Bottom navigation or top tabs: Today's Run, Completed
- No sidebar — keep it simple

### Today's Run (`/driver`)
- List of assigned deliveries for today sorted by assignment order
- Each card shows: recipient name, delivery address, items summary, status badge
- Tap a card to open the delivery detail

### Delivery Detail (`/driver/delivery/[id]`)
- Recipient name, address, phone number (tap to call), items list, special instructions
- "Navigate" button — opens Apple Maps (iOS) or Google Maps (Android) with the address pre-filled
- "I've arrived" button — marks `arrived_at`, unlocks POD capture
- POD capture section (visible after arriving)

### POD Capture

#### Signed delivery flow
1. Signature canvas — full width, touch/stylus enabled, clear button
2. Text field: "Receiver's full name" (typed by the person receiving)
3. Photo upload — opens device camera, preview before confirming, can add multiple photos
4. Submit button

#### Unattended delivery flow (no one home)
1. "No one onsite" button — triggers this flow
2. Mandatory photo — driver must capture at least one photo of the delivery location
3. Optional note field
4. Submit button

#### On submit
- Capture GPS coordinates at the moment of submission (request location permission on first use)
- Upload signature image and photos to R2
- Create `pod` and `pod_photos` records
- Update `delivery` and `order` status to `completed` or `attempted`
- Show confirmation screen: "Delivery recorded" with a summary
- Return to today's run list

### Offline Support
- Cache today's assigned deliveries on app load using service worker or local storage
- If the device goes offline during POD capture, queue the submission locally (IndexedDB)
- On reconnection, automatically sync queued submissions
- Show a visible offline indicator banner when there is no connection
- Disable submit button with message "Saving locally — will sync when online" when offline

---

## Shopify Integration

### Webhook Setup
- Expose a POST endpoint at `/api/webhooks/shopify`
- Subscribe to Shopify webhook topics: `orders/create` and `orders/paid`
- Verify webhook HMAC signature on every request using the Shopify webhook secret
- Handle idempotency — if the same Shopify order ID arrives twice, do not create a duplicate order

### Order Mapping
Map Shopify order fields to the `orders` table as follows:
- `shopify_order_id` → Shopify `id`
- `shopify_order_number` → Shopify `order_number`
- `recipient_name` → `shipping_address.name`
- `recipient_phone` → `shipping_address.phone`
- `recipient_email` → `email`
- `delivery_address` → formatted from `shipping_address` fields (address1, city, province, zip)
- `items` → map `line_items` array: `{ name: line_item.name, quantity: line_item.quantity }`
- `source` → `shopify`
- `status` → `pending` (back office assigns a driver)

### Edge Cases
- Orders with no shipping address → log and skip, do not create a delivery record
- Cancelled orders (`orders/cancelled` webhook) → if a delivery exists and is still `pending` or `assigned`, mark it as cancelled
- Test orders (Shopify test mode) → detect and skip or route to a test queue

### Back Office UI
- Orders sourced from Shopify display a Shopify badge and the order number
- Clicking the Shopify order number opens the order in Shopify admin (new tab)

---

## Email Parsing

### Inbound Email
- Configure Cloudflare Email Routing to forward emails sent to `deliveries@[yourdomain]` to a Cloudflare Worker
- The Worker saves the raw email to the `email_queue` table with status `pending_review`

### Parsing Logic
Attempt structured parsing first (regex/pattern matching for common fields):
- Look for patterns like `Recipient:`, `Address:`, `Phone:`, `Items:`, `Deliver to:`
- If structured parsing confidence is low, fall back to AI-assisted parsing using the Anthropic Claude API
- AI prompt should extract: recipient name, delivery address, phone number, items list, any special instructions
- Store extracted fields as JSON in `parsed_data`
- Always route parsed emails through the back office review queue before creating an order — do not auto-create orders from email

### Review Queue
- Back office sees the raw email and the parsed fields side by side
- All parsed fields are editable before approval
- On approval, create an `order` record from the parsed data with `source = email`

---

## Notifications

### Delivery Completion Email
- Trigger: when a POD is submitted and a delivery is marked `completed` or `attempted`
- Send to: back office email address (configurable in settings)
- Contents:
  - Subject: `Delivery [completed/attempted] — [Recipient Name] — [Address]`
  - Body: driver name, recipient name, delivery address, timestamp, POD type (signed/unattended), link to view POD record in the platform
- Use Resend or SendGrid for transactional email delivery

### Optional: Customer Notification
- After delivery completion, optionally send a read-only POD link to the recipient's email (if email was captured on the order)
- The link resolves to a public read-only page: `/pod/[token]` — no login required
- Page shows: delivery address, completion timestamp, driver first name only, signature (if signed), photos

---

## File Storage (Cloudflare R2)

- Bucket: `alaseel-pod-files`
- Folder structure: `pods/{pod_id}/signature.png` and `pods/{pod_id}/photos/{photo_id}.jpg`
- Signature images are saved as PNG from the canvas element (base64 → buffer → upload)
- Photos are uploaded directly from the device camera
- All R2 URLs stored in the database are private — generate signed URLs at read time with a short expiry (e.g. 1 hour) for display in the UI
- Never expose the R2 bucket publicly

---

## Environment Variables

The following environment variables are required. Store in `.env.local` (never commit this file).

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Neon / Database
DATABASE_URL=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Shopify
SHOPIFY_WEBHOOK_SECRET=
SHOPIFY_STORE_URL=
SHOPIFY_ADMIN_API_TOKEN=

# Email (Resend or SendGrid)
EMAIL_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_BACK_OFFICE_ADDRESS=

# Anthropic (for email parsing fallback)
ANTHROPIC_API_KEY=

# Cloudflare (for Hyperdrive)
CLOUDFLARE_ACCOUNT_ID=
HYPERDRIVE_BINDING=
```

---

## Non-Functional Requirements

### Security
- All API routes must validate the authenticated user's role before performing any action
- POD records must be immutable — no update or delete endpoints for `pods` or `pod_photos`
- Shopify webhooks must verify HMAC on every request
- R2 files must never be publicly accessible — always use signed URLs
- GPS and signature data are sensitive — do not log them

### Performance
- Driver app must load today's deliveries in under 2 seconds on a 4G connection
- Photo uploads should show a progress indicator
- Signature canvas must be responsive and lag-free on iOS and Android

### Offline
- Offline support is required for the driver app only — not the back office
- Use IndexedDB to queue POD submissions when offline
- Auto-sync queued submissions when connectivity is restored
- Show a clear offline/online status indicator

### Mobile UX
- All driver-facing tap targets must be at minimum 48×48px
- No hover-only interactions in the driver app
- Forms must not zoom on input focus (set `font-size: 16px` on all inputs for iOS)
- Camera access must use `capture="environment"` on file inputs to open the rear camera by default

---

## Project Structure

```
alaseel-pod/
├── app/
│   ├── (auth)/
│   │   └── sign-in/
│   ├── dashboard/           # Back office routes
│   │   ├── page.tsx         # Dashboard home
│   │   ├── orders/
│   │   ├── drivers/
│   │   ├── pods/
│   │   ├── email-queue/
│   │   └── settings/
│   ├── driver/              # Driver PWA routes
│   │   ├── page.tsx         # Today's run
│   │   └── delivery/[id]/
│   ├── api/
│   │   ├── webhooks/
│   │   │   └── shopify/
│   │   ├── pods/
│   │   ├── orders/
│   │   └── email-inbound/
│   └── pod/[token]/         # Public read-only POD view
├── components/
│   ├── back-office/
│   ├── driver/
│   └── shared/
├── db/
│   ├── schema.ts
│   └── migrations/          # Committed to git
├── lib/
│   ├── auth.ts
│   ├── r2.ts
│   ├── shopify.ts
│   ├── email-parser.ts
│   └── notifications.ts
├── drizzle.config.ts
├── wrangler.toml
└── .env.local               # Never committed
```

---

## Build Order

Build in this sequence — each phase depends on the previous:

1. **Foundation** — Clerk auth, Drizzle schema + migrations, R2 bucket, layout shells for both back office and driver app, deployment pipeline working end-to-end
2. **Back office order management** — manual order creation, driver assignment, orders list, order detail
3. **Driver POD capture** — today's run view, arrival flow, signed delivery capture, unattended delivery capture, offline queue
4. **Shopify integration** — webhook endpoint, order mapping, idempotency handling, Shopify badge in UI
5. **Email parsing** — inbound email to queue, structured + AI parsing, review queue UI
6. **Notifications + reporting** — completion emails, optional customer POD link, basic reporting, PDF export
