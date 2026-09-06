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
- `POST /api/admin/timeline/periods`
- `PUT /api/admin/timeline/periods/:id`
- `DELETE /api/admin/timeline/periods/:id`

Community funding routes:

- `GET /api/funding-goal`
- `GET /api/admin/funding-goal`
- `PUT /api/admin/funding-goal`

Apply the numbered files in `migrations/` to the bound D1 database in order
before deploying the matching timeline or community-funding features. Migration
`0003_community_funding_goal.sql` creates and seeds the single editable goal.
