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
| Student | `student@hosteldemo.com` | `Student@123` |
| Domestic guest | `guest@hosteldemo.com` | `Guest@123` |
| International guest | `foreign@hosteldemo.com` | `Guest@123` |

New resident accounts created by the admin receive the demo password `Welcome@123`.

## Local data and security

IndexedDB stores demo records, accounts, and hostel settings. LocalStorage keeps the current demo session and resident-portal permission preferences. Use **Settings → Demo data** to export or restore a JSON backup, or reset the workspace to its original sample data.

Authentication, permissions, and payment states are simulated in the browser. They are **not production-secure**: browser storage is user-editable, passwords are not protected by a server, and payment records are never real or independently verified. Do not enter sensitive personal, identity, or payment information.

All records remain on the device unless the user explicitly exports a backup. There are no backend services or external APIs.
