# imgstk

> JAMstack-friendly bulk image upload CDN powered by Cloudflare R2

imgstk is a simple yet powerful CDN system designed for managing large batches of images (100-200+ files) for JAMstack static sites. Built entirely on Cloudflare infrastructure for maximum performance, reliability, and cost-efficiency.

## Features

- **Bulk Upload**: Upload 100-500 images at once with drag & drop
- **Sequential Numbering**: Automatic 8-digit sequential filenames (`00000001.webp` ~ `99999999.webp`)
- **Flat R2 Structure**: Optimized for high-speed delivery
- **Batch Management**: Organize uploads into named batches (sessions)
- **Markdown Generation**: One-click Markdown template generation for JAMstack sites
- **Batch Deletion**: Delete entire batches including R2 objects
- **Basic Authentication**: Secure admin interface
- **Zero Dependencies**: Vanilla JavaScript frontend, Hono backend

## Architecture

```
imgstk/
├── worker/              # Cloudflare Worker (CDN delivery)
├── functions/           # Cloudflare Pages Functions (API with Hono)
├── public/              # Static admin UI (Vanilla JS)
├── db/                  # D1 database schema
└── docs/                # Documentation
```

### Tech Stack

- **R2**: Image storage (S3-compatible object storage)
- **D1**: Metadata database (SQLite-compatible)
- **Worker**: CDN image delivery
- **Pages + Functions**: Admin UI + API (Hono)
- **Vanilla JS**: Lightweight frontend

## Setup

### Prerequisites

- Cloudflare account
- Wrangler CLI installed
- Node.js 18+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/masa162/imgstk.git
cd imgstk
```

2. Install dependencies:
```bash
npm install
```

3. R2 Bucket (already created):
```bash
# Bucket name: imgstk-bucket
# Binding: R2_BUCKET
```

4. D1 Database (already created):
```bash
# Database name: imgstk-db
# Database ID: 56b82fb3-9ec3-4c3e-917c-23e2da347682
# Migration already executed
```

## Configuration

### Worker Configuration

Edit `worker/wrangler.toml`:
```toml
name = "imgstk-worker"
main = "src/index.ts"
compatibility_date = "2024-11-21"
account_id = "c677241d7d66ff80103bab9f142128ab"

[vars]
ALLOWED_ORIGINS = "https://admin-stk.be2nd.com"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "imgstk-bucket"
```

### Pages Configuration

Edit `wrangler.toml` (root):
```toml
name = "imgstk-pages"
compatibility_date = "2024-11-21"
pages_build_output_dir = "public"
account_id = "c677241d7d66ff80103bab9f142128ab"

[vars]
BASIC_AUTH_USER = "mn"
BASIC_AUTH_PASS = "39"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "imgstk-bucket"

[[d1_databases]]
binding = "DB"
database_name = "imgstk-db"
database_id = "56b82fb3-9ec3-4c3e-917c-23e2da347682"
```

## Development

### Run Worker Locally

```bash
npm run dev:worker
```

Access at: `http://localhost:8787`

### Run Pages Locally

```bash
npm run dev:pages
```

Access at: `http://localhost:8788`

## Deployment

### Deploy Worker (CDN)

```bash
npm run deploy:worker
```

Custom domain: `stk.be2nd.com`

### Deploy Pages (Admin UI + API)

```bash
npm run deploy:pages
```

Custom domain: `admin-stk.be2nd.com`

### Set Custom Domains

After deployment, configure custom domains in Cloudflare dashboard:

1. **Worker**: `stk.be2nd.com` → imgstk-worker
2. **Pages**: `admin-stk.be2nd.com` → imgstk-pages

## Usage

### 1. Upload Images

1. Pre-process images locally (resize, WebP conversion, etc.)
2. Access admin UI: `https://admin-stk.be2nd.com`
3. Enter batch title (e.g., "Plant Observation 2025-11-21")
4. Drag & drop 100-200 images
5. Click "Upload"

### 2. Generate Markdown

1. Go to "Batch List" page
2. Click "Generate Markdown" on desired batch
3. Copy to clipboard
4. Paste into your JAMstack markdown file

Example output:
```markdown
<!-- Plant Observation 2025-11-21 (100枚) -->
![](https://stk.be2nd.com/00000001.webp)
![](https://stk.be2nd.com/00000002.webp)
...
![](https://stk.be2nd.com/00000100.webp)
```

### 3. Delete Batch

1. Go to "Batch List" page
2. Click delete button on unwanted batch
3. Confirm deletion
4. Images are deleted from both R2 and D1

## API Endpoints

### Public Endpoints (Worker)

- `GET /healthz` - Health check
- `GET /{filename}` - Serve image (e.g., `/00000001.webp`)

### Admin Endpoints (Pages Functions)

All require Basic Authentication (`mn:39`)

- `POST /api/upload` - Bulk upload images
- `GET /api/batches` - List all batches
- `GET /api/batches/:id` - Get batch details
- `DELETE /api/batches/:id` - Delete batch
- `POST /api/batches/:id/markdown` - Generate Markdown

## Database Schema

### Tables

- **sequence**: Global counter for sequential numbering
- **batches**: Batch metadata (title, date, count, range)
- **images**: Individual image metadata (filename, URL, size, etc.)

See [db/schema.sql](db/schema.sql) for details.

## URL Structure

Images are served with sequential 8-digit filenames:

```
https://stk.be2nd.com/00000001.webp
https://stk.be2nd.com/00000002.webp
...
https://stk.be2nd.com/99999999.webp
```

- **Capacity**: 99,999,999 images (実質無限)
- **Format**: Fixed 8-digit zero-padded numbers
- **No gaps on deletion**: Deleted images leave gaps (e.g., 1, 2, 4, 5... if 3 deleted)

## Performance

- **CDN Delivery**: <100ms via Cloudflare Edge
- **Cache**: `public, max-age=31536000, immutable`
- **ETag**: Automatic via R2
- **CORS**: Enabled for `be2nd.com` domains

## Cost Estimation

Based on Cloudflare pricing (as of 2024):

- **R2 Storage**: $0.015/GB/month
- **R2 Operations**: Class A (write) $4.50/million, Class B (read) $0.36/million
- **D1**: Free tier covers most use cases
- **Worker/Pages**: Free tier covers most use cases

**Example**: 10,000 images (10GB) = ~$0.15/month

## Security

- **Basic Authentication**: Username `mn`, Password `39`
- **CORS**: Restricted to `be2nd.com` domains
- **R2 Access**: Private, only via Worker/Functions

## Roadmap

### Phase 1 (Current)
- ✅ Bulk upload
- ✅ Sequential numbering
- ✅ Batch management
- ✅ Markdown generation
- ✅ CDN delivery

### Phase 2 (Future)
- [ ] Thumbnail generation
- [ ] Batch search/filter
- [ ] Batch editing (rename)
- [ ] Storage analytics
- [ ] Migration tool from Lolipop

## Comparison with imgbase

| Feature | imgstk | imgbase |
|---------|--------|---------|
| **Use Case** | Bulk photo galleries | Daily blog images |
| **Upload** | 100-500 at once | 1 at a time |
| **Filename** | Sequential numbers | Hash + short_id |
| **Management** | Simple archive | Full search/filter |
| **Target** | JAMstack sites | General blog use |

Both systems are independent and serve different purposes.

## License

ISC

## Author

masa162

## Links

- **GitHub**: https://github.com/masa162/imgstk
- **Requirements**: [docs/要件定義書v1.md](docs/要件定義書v1.md)
- **CDN**: https://stk.be2nd.com
- **Admin**: https://admin-stk.be2nd.com
