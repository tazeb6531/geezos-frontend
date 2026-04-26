# GeezOS Frontend — GEEZ EXPRESS LLC

## Pages included
- `/` — Login page
- `/dashboard` — Overview stats + recent loads + outstanding alerts
- `/dispatch` — Load board + AI extraction + document upload
- `/fleet` — Driver roster + truck fleet + stats
- `/payroll` — Settlements + advances + history
- `/reports` — Revenue by broker/driver/route/month + outstanding
- `/settings` — Company profile + email config + system

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create environment file
```bash
cp .env.example .env.local
```
Fill in your values — especially AUTH0 settings and the API URL.

### 3. Run locally
```bash
npm run dev
```
Open http://localhost:3000

### 4. Deploy to Vercel
```bash
# Push to GitHub first
git init
git add .
git commit -m "GeezOS frontend"
git remote add origin https://github.com/YOUR_USERNAME/geezos-frontend.git
git push -u origin main
```
Then connect the GitHub repo to Vercel at vercel.com.

Add environment variables in Vercel dashboard matching your .env.local.

## Connect to your domain
In Vercel → Settings → Domains → add `app.geezxpress.com`
In GoDaddy → DNS → add CNAME record pointing to your Vercel deployment URL.

## Backend URL
`https://geezos-api-a0gcdncwefdchgf3.eastus2-01.azurewebsites.net`
