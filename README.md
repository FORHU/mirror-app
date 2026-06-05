# Mirror App

Mirror App is a Next.js 16 project

## Project Overview

- **Framework:** Next.js App Router with React 19 and TypeScript
- **Styling:** Tailwind CSS 4 with global theme support (`next-themes`)
- **State Management:** Zustand for client-side auth state
- **Networking:** Apisauce-based API client and auth services

## Getting Started

After cloning the repository, run these commands:

```bash
git clone <your-repo-url>
cd mirror-app
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Developer Access Flow

1. **Clone the project** to your local machine.
2. **Move into the project directory** (`cd mirror-app`).
3. **Install dependencies** with `npm install`.
4. **Start the development server** with `npm run dev`.
5. **Access the app in browser** at `http://localhost:3000`.

## Scripts

- `npm run dev` - start development server
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run lint` - run ESLint
- `npm run check` - run TypeScript checks
- `npm run format` - format files with Prettier

## Main Structure

- `app/` - routes, layouts, and app-level metadata
- `components/` - app-level components
- `modules/shared/` - shared components, API, hooks, store, and utilities
- `public/` - static assets

## Notes

- App metadata and branding are configured in `app/layout.tsx`.
- Set `NEXT_PUBLIC_SITE_URL` for production metadata URLs.
