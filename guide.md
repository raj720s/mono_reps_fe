# fe_standard — Monorepo Guide (Summary Notes)

A practical reference for everything implemented in this repository: pnpm + Lerna
monorepo, shared config packages, Jest test coverage, SonarQube quality gates, and
how to manage multiple React apps and deploy each one independently through CI/CD.

---

## 1. What this repo is

`fe_standard` is a **pnpm workspace monorepo** orchestrated with **Lerna** that hosts:

- Multiple **React + TypeScript + Vite** applications under `apps/`
- Reusable **shared packages** under `packages/` (UI, utils, ts-config, eslint-config, jest-config)

Goal: one repository, shared tooling and code, but each app built, tested and
deployed **independently**.

### Tech stack

| Concern | Tool |
|---|---|
| Package manager | pnpm (workspaces) |
| Monorepo orchestration | Lerna |
| Apps | React 19 + TypeScript + Vite |
| Testing | Jest + ts-jest + Testing Library (jsdom) |
| Linting | ESLint flat config (shared package) |
| Code quality | SonarQube (local Docker) / SonarCloud |
| Deployment (app) | S3 + CloudFront (per-app bucket/distribution) |
| Release | semantic-release |

---

## 2. Repository structure

```text
fe_standard/
├── apps/
│   └── customerPortal/          # React + Vite app (package name: "customerportal")
│       ├── src/
│       │   ├── app/             # app shell / providers
│       │   ├── features/        # feature modules (masterdata, ...)
│       │   │   └── masterdata/api/   # API calls only
│       │   ├── shared/          # app-level shared utilities
│       │   │   └── services/    # API response handling + business logic
│       │   ├── test/
│       │   │   ├── unit/        # *.test.tsx
│       │   │   ├── __mocks__/   # styleMock.js, fileMock.js
│       │   │   └── setup.ts     # jest-dom setup
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── jest.config.cjs
│       ├── eslint.config.js
│       ├── vite.config.ts
│       └── tsconfig*.json
├── packages/
│   ├── ui/                      # @fe_standard/ui    (shared components)
│   ├── utils/                   # @fe_standard/utils (shared helpers)
│   ├── ts-config/               # @fe_standard/ts-config   (base TS configs)
│   ├── eslint-config/           # @fe_standard/eslint-config
│   └── jest-config/             # @fe_standard/jest-config
├── docker-compose.yaml          # SonarQube + Postgres
├── sonar-project.properties
├── pnpm-workspace.yaml
├── lerna.json
├── package.json
├── setup.md                     # step-by-step bootstrap guide
└── readme.md                    # raw working notes
```

---

## 3. Monorepo fundamentals

### 3.1 Workspace definition

`pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

`lerna.json`

```json
{
  "$schema": "node_modules/lerna/schemas/lerna-schema.json",
  "version": "0.0.0",
  "npmClient": "pnpm",
  "packages": ["apps/*", "packages/*"]
}
```

### 3.2 Root scripts

```json
{
  "scripts": {
    "dev": "lerna run dev --parallel --stream",
    "build": "lerna run build",
    "lint": "lerna run lint --stream",
    "test": "lerna run test",
    "sonar": "sonar-scanner"
  }
}
```

- `lerna run <script>` runs the script in every package that defines it.
- `--parallel --stream` runs dev servers simultaneously with interleaved logs.
- To target one package always use **`pnpm --filter <package-name>`**.

### 3.3 Package naming (critical learning)

The folder name and the `package.json` `name` can differ:

- Folder: `apps/customerPortal`
- Package name: `customerportal`

`pnpm --filter` and `workspace:*` use the **`package.json` name**, not the folder.

```bash
pnpm --filter customerportal dev      # correct
pnpm --filter customer-portal dev     # wrong (folder/mismatch)
```

### 3.4 Referencing shared packages

Shared packages are linked with the `workspace:*` protocol:

```bash
pnpm add @fe_standard/ui@workspace:* --filter customerportal
pnpm add @fe_standard/utils@workspace:* --filter customerportal
pnpm add @fe_standard/eslint-config@workspace:* --filter customerportal
pnpm add @fe_standard/jest-config@workspace:* --filter customerportal
```

Because packages ship raw `src` (`"main": "./src/index.ts"`), Vite + ts-jest consume
the TypeScript directly — no per-package build step required.

---

## 4. Shared packages

### 4.1 `@fe_standard/ts-config`

Base configs consumed via `extends`:

- `base-config.json` — strict, `esnext`, `bundler` resolution, `noEmit`
- `react-app-config.json` — adds `jsx: react-jsx`, DOM libs, `vite/client` types
- `react-package-config.json` — for library packages, enables `declaration`

App usage:

```json
{ "extends": "../../packages/ts-config/react-app-config.json" }
```

Package usage:

```json
{ "extends": "../ts-config/react-package-config.json", "include": ["src"] }
```

### 4.2 `@fe_standard/eslint-config`

Exports a flat-config array `reactConfig` from `./react`:

```js
import { reactConfig } from "@fe_standard/eslint-config";
export default reactConfig;
```

Includes: recommended JS + TS rules, react-hooks, react-refresh, `no-console: warn`,
`prefer-const: error`, and ignores for `dist`, `coverage`, config files.

### 4.3 `@fe_standard/jest-config`

Shared Jest preset (`react.js`) — see section 6.

### 4.4 `@fe_standard/ui` / `@fe_standard/utils`

- `ui` exports `Button` (CSS Modules) from `src/index.ts`.
- `utils` exports `formatCurrency(value, currency, locale)` using `Intl.NumberFormat`.
- Consumed by apps as normal imports: `import { Button } from '@fe_standard/ui'`.

---

## 5. Creating a new React app

```bash
# from repo root
pnpm create vite apps/<appName> --template react-ts
pnpm install

# wire shared tooling
pnpm add @fe_standard/ui@workspace:* --filter <appname>
pnpm add @fe_standard/ts-config@workspace:* --filter <appname>
pnpm add @fe_standard/eslint-config@workspace:* --filter <appname>
pnpm add @fe_standard/jest-config@workspace:* --filter <appname>
```

Then, in the app:

1. `tsconfig.app.json` → extend `../../packages/ts-config/react-app-config.json`
2. `eslint.config.js` → `export default reactConfig`
3. `jest.config.cjs` → spread `@fe_standard/jest-config/react` and set `testMatch`
4. Add `src/test/setup.ts`, `__mocks__/styleMock.js`, `__mocks__/fileMock.js`

---

## 6. Testing & coverage (Jest)

### 6.1 App Jest config

`apps/customerPortal/jest.config.cjs`

```js
module.exports = {
  ...require("@fe_standard/jest-config/react"),
  testMatch: ["<rootDir>/src/**/*.{spec,test}.{ts,tsx}"]
};
```

### 6.2 Shared preset

`packages/jest-config/react.js`

```js
module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tsconfig.test.json" }]
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  moduleNameMapper: {
    "\\.module\\.(css|sass|scss)$": "<rootDir>/src/test/__mocks__/styleMock.js",
    "\\.(css|less|sass|scss)$": "<rootDir>/src/test/__mocks__/styleMock.js",
    "\\.(gif|ttf|eot|svg|png|jpg|jpeg)$": "<rootDir>/src/test/__mocks__/fileMock.js"
  },
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  collectCoverage: true,
  coverageThreshold: {
    global: { branches: 80, functions: 60, lines: 80, statements: 80 }
  },
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"]
};
```

Key points:

- **jsdom** environment for React DOM.
- **ts-jest** compiles TS/TSX using the app's `tsconfig.test.json`
  (commonjs + esModuleInterop so Jest can load TS as CJS).
- **CSS/asset mocks** via `moduleNameMapper` (Proxy-based styleMock, string fileMock).
- **`setupFilesAfterEnv`** loads `@testing-library/jest-dom` matchers
  (`toBeInTheDocument`, etc.).
- **Coverage** always collected; `lcov.info` is generated for Sonar.
- **Thresholds** enforce quality: functions 60%, branches/lines/statements 80%.

### 6.3 Test example

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";

describe("App", () => {
  it("renders the App Button", async () => {
    window.alert = jest.fn();
    render(<App />);
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
  });
});
```

### 6.4 Commands

```bash
pnpm --filter customerportal test           # run tests for one app
pnpm test                                   # run tests across all packages
```

Output: `apps/customerPortal/coverage/` with `lcov.info`, HTML report, console summary.

> Note: `coverage/` is git-ignored, which is correct — coverage is a CI artifact,
> generated fresh on every run and fed to Sonar.

---

## 7. SonarQube implementation

### 7.1 Local server (Docker)

`docker-compose.yaml` runs SonarQube LTS Community + PostgreSQL:

```bash
docker compose up -d
# UI: http://localhost:9000   (default admin/admin, change on first login)
```

Components:

- `sonarqube:lts-community` exposed on port `9000`
- `postgres:15-alpine` backing store
- Named volumes for data/extensions/logs/db persistence
- Bridge network `sonar-net`

### 7.2 Project config

`sonar-project.properties`

```properties
sonar.projectKey=sonar_mono
sonar.host.url=http://localhost:9000
sonar.login=<TOKEN>

sonar.sources=apps,packages
sonar.tests=apps
sonar.test.inclusions=**/*.test.ts,**/*.test.tsx

sonar.javascript.lcov.reportPaths=apps/customerPortal/coverage/lcov.info

sonar.exclusions=**/coverage/**,**/dist/**,**/.github/**,packages/eslint-config/**,packages/typescript-config/**,packages/jest-config/**
```

Key points / learnings:

- `sonar.sources` = production code; `sonar.tests` = test code (kept separate).
- **Path casing must match the filesystem** (`customerPortal`, not `customerportal`)
  or coverage import silently fails.
- Exclusions must be **comma-separated, no line-continuation backslashes** in the
  properties file.
- `lcov.reportPaths` points at Jest's `coverage/lcov.info` — this is what gives
  Sonar real coverage numbers instead of "0%".

### 7.3 Running a scan

```bash
# 1. generate coverage (must run first)
pnpm --filter customerportal test

# 2. scan
pnpm sonar          # == sonar-scanner
```

- Token is stored in `sonar.login` locally. **In CI, never commit the token** —
  store it in GitHub Secrets (`SONAR_TOKEN`) and pass via env / `-Dsonar.token`.
- `sonar.javascript.lcov.reportPaths` must point to the coverage of every app you
  want measured; for multiple apps, list them comma-separated.

### 7.4 Sonar in CI (recommended pattern)

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm test                       # produces coverage/lcov.info per app
- run: npx sonar-scanner
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
    SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

Use a SAST/quality gate stage that **fails the pipeline** when the gate fails.

---

## 8. Managing multiple React apps

The pattern scales to `apps/customerPortal`, `apps/adminPortal`, `apps/partnerPortal`, etc.

### 8.1 Rules that make multi-app work

1. **One package per app** with a unique, lowercase `name` in `package.json`
   (e.g. `customerportal`, `adminportal`).
2. **Shared code lives in `packages/`** — never import `apps/*` from another app.
3. **Shared tooling is centralized** in config packages (ts/eslint/jest) so a
   change applies to every app at once.
4. **App-specific config stays in the app** (`vite.config.ts`, `jest.config.cjs`,
   `tsconfig*.json`), thin and extending the shared base.
5. **Feature-based app structure**:

   ```text
   src/
   ├── app/         # shell, routing, providers
   ├── features/    # vertical slices (each owns api/, components/, hooks/)
   ├── shared/      # app-wide utils
   │   └── services/  # API response handling + business logic
   └── test/
   ```

   API layer (`features/*/api`) only performs HTTP calls; business/response logic
   goes in `shared/services` — keeps API code dumb and testable.
6. **Independent build output**: each app builds to its own `dist/`.

### 8.2 Running/targeting apps

```bash
pnpm --filter customerportal dev
pnpm --filter customerportal build
pnpm --filter customerportal test
pnpm --filter customerportal lint

# all apps
pnpm dev / pnpm build / pnpm test / pnpm lint
```

### 8.3 Adding a shared dependency

```bash
# root dev tooling
pnpm add -Dw <pkg>

# into one app
pnpm add <pkg> --filter customerportal

# into a shared package
pnpm add <pkg> --filter @fe_standard/ui
```

---

## 9. CI/CD — deploy each app separately

### 9.1 Principles

- **One workflow per app** (or one reusable/matrix workflow), so deploying
  `customerPortal` never redeploys `adminPortal`.
- Trigger on **path filters** (`paths:`), so only changes to that app (or to shared
  `packages/`) trigger its pipeline.
- Each app has its **own S3 bucket + CloudFront distribution** (or path prefixes
  behind one distribution).
- Store per-app secrets/env under distinct names or GitHub **Environments**.

### 9.2 Per-app deploy workflow (S3 + CloudFront)

`.github/workflows/deploy-customer-portal.yml`

```yaml
name: Deploy customerPortal

on:
  push:
    branches: [main]
    paths:
      - 'apps/customerPortal/**'
      - 'packages/**'
      - 'pnpm-lock.yaml'
      - '.github/workflows/deploy-customer-portal.yml'
  workflow_dispatch:

concurrency:
  group: deploy-customer-portal
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: prod
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 12

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter customerportal lint
      - run: pnpm --filter customerportal test
      - run: pnpm --filter customerportal build

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Upload to S3
        run: aws s3 sync apps/customerPortal/dist s3://${{ secrets.S3_BUCKET_NAME }} --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

Repeat for `adminPortal` with its own `paths`, bucket and distribution.

### 9.3 Reusable / matrix approach (DRY, many apps)

`.github/workflows/deploy-apps.yml`

```yaml
name: Deploy apps

on:
  push:
    branches: [main]
    paths:
      - 'apps/**'
      - 'packages/**'
      - 'pnpm-lock.yaml'
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        include:
          - app: customerportal
            path: apps/customerPortal
            bucket_secret: S3_BUCKET_CUSTOMER
            cdn_secret: CF_DIST_CUSTOMER
          - app: adminportal
            path: apps/adminPortal
            bucket_secret: S3_BUCKET_ADMIN
            cdn_secret: CF_DIST_ADMIN
    environment: prod
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 12 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter ${{ matrix.app }} lint
      - run: pnpm --filter ${{ matrix.app }} test
      - run: pnpm --filter ${{ matrix.app }} build
      # ... aws creds + s3 sync ${{ matrix.path }}/dist + cloudfront invalidation
```

> For true "only changed apps", use `tj-actions/changed-files` or
> `dorny/paths-filter` to compute a dynamic matrix and skip untouched apps.

### 9.4 Shared packages → rebuild dependents

When `packages/ui` changes, every app that depends on it should rebuild. Handle by:

- Including `packages/**` in each app's `paths` filter, or
- Using Lerna's change detection: `npx lerna changed` / `lerna run build --since origin/main`.

### 9.5 Quality gate workflow

`.github/workflows/quality.yml`

```yaml
name: Quality

on: [pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
        with: { version: 12 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - name: Sonar scan
        run: npx sonar-scanner
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

### 9.6 Release / versioning

- semantic-release runs on `main` after quality gates pass.
- Enable **Settings → Actions → General → Read and write permissions**.
- Workflow: `.github/workflows/release.yml` using
  `@semantic-release/commit-analyzer`, `release-notes-generator`, `changelog`,
  `git`, `github`.
- For a fixed-version monorepo, Lerna can also publish/version packages together.

### 9.7 AWS prerequisites (per app)

- IAM user with `AmazonS3FullAccess` + `CloudFrontFullAccess`, access key created
  for "application running outside AWS".
- One S3 bucket per app; CloudFront distribution pointing at it.
- CloudFront custom error responses: `403 → /index.html`, `404 → /index.html`
  (needed for React Router deep links).
- Bucket private + CloudFront OAC policy (replace bucket ARN + distribution ARN):

```json
{
  "Version": "2008-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontServicePrincipal",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*",
    "Condition": {
      "ArnLike": {
        "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
      }
    }
  }]
}
```

### 9.8 Secrets to configure

| Secret | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | deploy credentials |
| `AWS_SECRET_ACCESS_KEY` | deploy credentials |
| `AWS_REGION` | target region |
| `S3_BUCKET_NAME` (per app) | upload target |
| `CLOUDFRONT_DISTRIBUTION_ID` (per app) | cache invalidation |
| `SONAR_TOKEN` | Sonar auth |
| `SONAR_HOST_URL` | Sonar server URL |

Per-app values should live in GitHub **Environments** (e.g. `prod-customer`,
`prod-admin`) so each app's pipeline resolves its own secrets.

---

## 10. Command cheat sheet

```bash
# install everything
pnpm install

# dev / build / lint / test all
pnpm dev
pnpm build
pnpm lint
pnpm test

# single app (by package name)
pnpm --filter customerportal dev
pnpm --filter customerportal build
pnpm --filter customerportal test
pnpm --filter customerportal lint

# add dependencies
pnpm add -Dw <pkg>                          # root tooling
pnpm add <pkg> --filter customerportal      # app dependency
pnpm add @fe_standard/ui@workspace:* --filter customerportal

# sonar
docker compose up -d                        # start SonarQube
pnpm --filter customerportal test           # produce coverage
pnpm sonar                                  # scan
```

---

## 11. Gotchas / learnings

- **Folder vs package name**: `pnpm --filter` uses `package.json#name`
  (`customerportal`), not the folder (`customerPortal`).
- **Path casing in Sonar**: `sonar.javascript.lcov.reportPaths` must match the real
  folder casing or coverage is not imported.
- **Sonar exclusions**: comma-separated; no backslash line continuations.
- **Jest + TS**: use `tsconfig.test.json` with `module: commonjs`,
  `esModuleInterop: true` for ts-jest; keep `verbatimModuleSyntax: false`.
- **CSS/asset imports in tests**: must be mapped (`styleMock`/`fileMock`) or Jest
  throws on `.css`/`.svg`/`.png`.
- **`jest-dom` matchers**: require `setupFilesAfterEnv → setup.ts`.
- **Coverage is an artifact**, not source: git-ignore `coverage/`; regenerate in CI.
- **Vite CSS types**: if `.css` imports error, ensure `vite-env.d.ts` references
  `vite/client` (types provided via `react-app-config.json`).
- **CRA/CRA-style `main` fields**: shared packages exposing raw `src` work for Vite
  and ts-jest, but they must not import Node-only APIs into browser bundles.
- **Don't deploy all apps on any change**: always use `paths:` filters or changed-file
  detection, otherwise a UI package tweak needlessly redeploys every app.

---

## 12. Suggested next steps

- Add `.github/workflows/` (deploy per app + quality + release) — templates in section 9.
- Add `apps/adminPortal` (or similar) to validate the multi-app flow end to end.
- Add e2e tests (Playwright) as a separate job, not inside the Jest unit gate.
- Generate `sonar.javascript.lcov.reportPaths` for **all** apps (comma-separated)
  as more apps are added.
- Consider changesets or Lerna fixed/independent versioning for shared package releases.
