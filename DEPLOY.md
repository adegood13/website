# Deploying askbobai.com to AWS

This is an Astro static site — no server, no database. Once built it's ~15 HTML
files + ~55MB of assets (the bulk is the two video files). Two hosting paths
below. **If you want the fewest clicks, use Option A (Amplify).**

---

## Option A — AWS Amplify Hosting (recommended)

**Why:** connect a Git repo once, every push auto-builds and deploys. Free SSL.
Custom domain wiring takes 5 minutes. No S3 commands to learn.

### One-time setup

1. **Push this folder to Git.** GitHub, GitLab, CodeCommit — all work.
   ```bash
   cd /Users/andrewdegood/Desktop/Claude/askbobai-rebuild
   git init
   git add .
   git commit -m "Initial Astro rebuild of askbobai.com"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **AWS Console → Amplify → "Host web app" → connect your Git repo.**
   Amplify auto-detects Astro. Accept defaults:
   - Build command: `npm run build`
   - Output directory: `dist`

3. **First deploy** runs automatically. Amplify gives you a URL like
   `main.xxxxxxxx.amplifyapp.com`.

4. **Custom domain:** Amplify Console → Domain management → "Add domain" →
   `askbobai.com`. Amplify provisions the SSL cert and gives you DNS records.
   Paste those into whoever holds `askbobai.com` DNS (probably Namecheap,
   GoDaddy, or Cloudflare). Propagation: ~15 min to a few hours.

### Ongoing workflow

- Edit a page (e.g. `src/pages/about.astro`)
- `git commit -am "fix typo"` → `git push`
- Amplify builds + publishes in ~2 minutes. Done.

### Cost

- Build minutes: $0.01 / min (each deploy ~2 min = ~$0.02)
- Hosting: $0.023 / GB served + $0.15 / GB stored
- **Realistic monthly cost for this site: $5–$15** depending on traffic.

---

## Option B — S3 + CloudFront (cheaper, more manual)

**Why:** you pay ~$1/month for low traffic. Trade-off: you run the deploy
yourself (or set up GitHub Actions).

### One-time setup

1. **Create the S3 bucket.**
   - AWS Console → S3 → Create bucket → `askbobai-site` (must be globally
     unique; add a suffix if taken)
   - Region: `us-east-1` (required for CloudFront ACM certs)
   - Block all public access: **uncheck** (we'll lock this down via CF-only
     below)
   - Enable Static website hosting, Index: `index.html`

2. **Create an ACM certificate** in **us-east-1** for `askbobai.com` and
   `www.askbobai.com`. Validate via DNS.

3. **Create CloudFront distribution.**
   - Origin: your S3 bucket (use "S3 bucket" not "website endpoint" so you can
     keep the bucket private via OAC)
   - Default root object: `index.html`
   - Alternate domain names: `askbobai.com`, `www.askbobai.com`
   - SSL cert: the ACM cert from step 2
   - Price class: "Use all edge locations" (or "North America + Europe" to save)
   - **Custom error response:** 403 → `/404.html` (403 because S3 returns 403
     for missing keys when OAC is used)

4. **Point DNS** at the CloudFront distribution (`dxxxx.cloudfront.net`).
   Create an ALIAS/ANAME/CNAME from `askbobai.com` to the distribution.

### Deploy command

From this folder:

```bash
# 1. Build
export PATH="/Users/andrewdegood/Desktop/Claude/tools/node/bin:$PATH"
npm run build

# 2. Sync static assets with long cache
aws s3 sync dist/ s3://askbobai-site/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" --exclude "sitemap*.xml" --exclude "robots.txt"

# 3. Sync HTML with short cache (so copy edits go live fast)
aws s3 sync dist/ s3://askbobai-site/ \
  --cache-control "public, max-age=300, must-revalidate" \
  --exclude "*" --include "*.html" --include "sitemap*.xml" --include "robots.txt"

# 4. Invalidate CloudFront so changes show up immediately
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXXXXXXXX \
  --paths "/*"
```

Save that as `deploy.sh` and `chmod +x` it.

### Optional: Automate via GitHub Actions

`.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push: { branches: [main] }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE }}
          aws-region: us-east-1
      - run: aws s3 sync dist/ s3://askbobai-site/ --delete
      - run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_DIST_ID }} --paths "/*"
```

### Cost

- S3: ~$0.10 / month for 60MB stored
- CloudFront: $0.085 / GB data transfer (first 10TB free tier in year 1)
- ACM cert: free
- Route 53 (if you use it): $0.50 / hosted zone / month
- **Realistic monthly cost: $1–$5**

---

## Videos — special note

The two video files live at `/public/videos/`:
- `commercial.mp4` (14 MB)
- `commercial.webm` (5.8 MB)

Astro copies them into `dist/videos/` at build time — they ship with the site.
On Amplify or CloudFront they'll be served with the same performance as any
other static asset.

**If you start adding more / bigger videos,** move videos to their own S3
bucket + separate CloudFront distribution. Keeps build-time small and lets
you do proper HLS streaming later without touching the rest of the site.

---

## Pre-launch checklist

Before you flip DNS over to the new site:

- [ ] **HubSpot Form ID** — swap `REPLACE_ME` in `src/pages/get-a-demo.astro`
      for the real Form ID from HubSpot. Until this is set, form submissions
      log to browser console instead of actually submitting.
- [ ] **Team photos** — `src/pages/about.astro` currently shows initials for
      Andrew + Tim. Drop real headshots into `/public/images/team/` as
      `andrew.jpg` and `tim.jpg` and uncomment the `<img>` block in About.
- [ ] **Blog & Guides slug routes** — the index pages (`/resources/blog`,
      `/resources/guides`) link to `/resources/blog/<slug>` and
      `/resources/guides/<slug>`. Those detail pages don't exist yet. Either
      (a) hide the cards behind "Coming soon" badges, (b) build the detail
      pages, or (c) wire into a headless CMS.
- [ ] **Copy review** — stat values (12+/98%/5x) and industry-tab copy on the
      home page are best-guesses. Swap in real data.
- [ ] **Favicon** — currently using the AskBobAI SVG logo. Consider adding a
      multi-size favicon.ico for older browsers.
- [ ] **Robots + sitemap** — Astro's `@astrojs/sitemap` integration can
      auto-generate one. Add it if you want search engines to discover pages
      more easily.
- [ ] **Redirect old Framer URLs** — if any external sites link to old Framer
      paths (e.g. `askbobai.com/solutions-byindustry-mortgage`), add redirects
      in Amplify (`_redirects` file) or CloudFront.
- [ ] **Analytics IDs** — GTM (`GTM-K96Q7JXP`), GA4 (`G-G1CVKBX4QR`), HubSpot
      (portal `45488669`) are all baked into `src/layouts/Layout.astro`.
      Confirm these are the right IDs for production.

---

## File structure reference

```
askbobai-rebuild/
├─ public/
│  ├─ images/               ← logos, illustrations, team photos go here
│  ├─ videos/               ← commercial.mp4, .webm, poster.jpg
│  └─ ...
├─ src/
│  ├─ components/           ← Nav, Footer, Hero, Stats, CTABanner, etc.
│  ├─ layouts/Layout.astro  ← site-wide HTML shell, analytics, HubSpot
│  ├─ pages/                ← one .astro per route
│  │  ├─ index.astro              → /
│  │  ├─ about.astro              → /about
│  │  ├─ get-a-demo.astro         → /get-a-demo
│  │  ├─ ai-agents.astro          → /ai-agents
│  │  ├─ privacy.astro            → /privacy
│  │  ├─ terms.astro              → /terms
│  │  ├─ platform/*.astro         → /platform/...
│  │  ├─ solutions/industry/*     → /solutions/industry/...
│  │  ├─ solutions/function/*     → /solutions/function/...
│  │  └─ resources/*              → /resources/...
│  └─ styles/global.css     ← Tailwind + design tokens
└─ DEPLOY.md                ← this file
```

---

## Local development

```bash
export PATH="/Users/andrewdegood/Desktop/Claude/tools/node/bin:$PATH"
cd /Users/andrewdegood/Desktop/Claude/askbobai-rebuild
npm run dev        # opens at http://localhost:4321
```

To build the production bundle and preview it:

```bash
npm run build      # outputs to dist/
npm run preview    # serves dist/ on http://localhost:4321
```

---

Questions, bugs, or new page ideas — the site is now yours to edit directly.
Every page is a plain .astro file that looks 95% like HTML.
