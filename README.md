# Malawian App Store

Malawian App Store (MAS) is a digital marketplace for discovering and publishing apps and websites. It is intended to connect users with locally published digital products and give developers tools to manage their listings.

## Product areas

- **App and website discovery:** Browse published digital products.
- **Developer accounts:** Switch between user and developer experiences.
- **Developer verification:** Identity verification and developer trust indicators.
- **Publishing:** Submit and update app or website listings.
- **Developer dashboard:** Manage listings and review activity.
- **Reviews:** Collect and display feedback on published products.
- **Account tools:** Authentication, profile settings, and notifications.

Feature availability depends on the current application implementation and backend configuration. This README does not imply that every planned feature or external integration is live.

## Technology

The web application uses:

- React and TypeScript
- TanStack Start and TanStack Router
- Vite
- Supabase client libraries
- Tailwind CSS

## Getting started

### Requirements

- Node.js
- npm

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Configuration and security

Configure the required public application and Supabase settings using the project's deployment environment. Never expose service-role keys, payment secrets, identity-provider secrets, or webhook signing secrets in browser code.

Backend authorization and database access must be enforced server-side and through correctly configured Supabase Row Level Security policies.

## Development

Keep the web application separate from the native Android MAS repository. Preserve existing authentication, publishing, review, and developer-verification flows when making changes.

## Repository

- GitHub: [V1CT330/malawian-app-store](https://github.com/V1CT330/malawian-app-store)
