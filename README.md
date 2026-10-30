# Haven House — Hostel & Guest Management

A frontend-only hostel management demonstration built with React, TypeScript, Vite, and IndexedDB. It includes admin and resident portals, role-aware navigation, browser-persisted demo records, management tables, reports, and interactive dashboards.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

## Demo accounts

| Account | Email | Password |
|---|---|---|
| Admin | `admin@hosteldemo.com` | `Admin@123` |
| Reception | `reception@hosteldemo.com` | `Reception@123` |
| Housekeeping | `housekeeping@hosteldemo.com` | `Cleaning@123` |
| Student | `student@hosteldemo.com` | `Student@123` |
| Domestic guest | `guest@hosteldemo.com` | `Guest@123` |
| International guest | `foreign@hosteldemo.com` | `Guest@123` |

New resident accounts created by the admin receive the demo password `Welcome@123`.
Admins can create reception and housekeeping logins from **Staff → Add employee** by selecting a portal access role. Staff accounts receive the demo password `Welcome@123`. Reception can manage guest stays, attendance, visitors, and bookings. Guest check-out creates a room-cleaning task; housekeeping marks it in progress and then completed to return the room to **Available**.

Reception can punch residents in and out from **Attendance**; the live register is reflected on staff/admin dashboards and each resident's attendance view. Student and guest IDs are generated on creation. Guest registration displays meal preferences and tea/coffee service times for Premium, Deluxe, or Luxury rooms. The room map distinguishes occupied, booked, reserved, cleaning, and maintenance states.

## Local data and security

IndexedDB stores demo records, accounts, and hostel settings. LocalStorage keeps the current demo session and resident-portal permission preferences. Use **Settings → Demo data** to export or restore a JSON backup, or reset the workspace to its original sample data.

Authentication, permissions, and payment states are simulated in the browser. They are **not production-secure**: browser storage is user-editable, passwords are not protected by a server, and payment records are never real or independently verified. Do not enter sensitive personal, identity, or payment information.

All records remain on the device unless the user explicitly exports a backup. There are no backend services or external APIs.
