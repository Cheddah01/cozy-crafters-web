# Cozy Archive Worker

The deployed `cozy-archive` Cloudflare Worker source is backed up in
`cozy-archive-worker.js`.

Required Cloudflare bindings:

- `DB`: D1 database `cozy-archive-db`
- `ARCHIVE_BUCKET`: R2 bucket `cozy-archive`

Timeline routes:

- `GET /api/timeline`
- `GET /api/timeline/events/:id/image`
- `GET /api/admin/timeline`
- `POST /api/admin/timeline`
- `PUT /api/admin/timeline/:id`
- `DELETE /api/admin/timeline/:id`

Apply `migrations/0001_timeline_events.sql` to the bound D1 database before
deploying timeline support.
