# React Monorepo Setup Guide

## 1. Initialize the Monorepo

### Initialize the project

```bash
npm init -y
```

### Create the workspace configuration

Create a file named `pnpm-workspace.yaml`.

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### Install Lerna

```bash
pnpm add -Dw lerna
```

### Initialize Lerna

```bash
npx lerna init
```

### Update the root `package.json`

- Mark the repository as `private`
- Configure workspaces
- Add the required scripts

### Create the workspace folders

```text
apps/
packages/
```

---

# 2. Create the React Application

Create a new React + TypeScript application.

```bash
pnpm create vite apps/customer-portal --template react-ts
```

Install all workspace dependencies.

```bash
pnpm install
```

---

# 3. Create the Shared UI Package

Inside `packages/` create a UI package.

Example:

```text
packages/
└── ui/
```

Configure:

- package.json
- tsconfig.json
- src/
- exports

---

# 4. Configure TypeScript

Create a root TypeScript configuration.

```text
tsconfig.base.json
```

Extend this configuration inside every workspace package.

Example:

```text
packages/ui/tsconfig.json
apps/customer-portal/tsconfig.json
```

---

# 5. Create Shared TypeScript Config Package

Create a reusable package.

```text
packages/
└── typescript-config/
```

This package should contain all reusable TypeScript configurations used across the monorepo.

---

# 6. Verify the Build

Build the application.

```bash
pnpm --filter customer-portal build
```

---

# 7. Configure ESLint

Install ESLint.

```bash
pnpm add -Dw \
eslint \
@eslint/js \
globals \
eslint-plugin-react-hooks \
eslint-plugin-react-refresh
```

Create a reusable ESLint configuration package.

```text
packages/
└── eslint-config/
```

Create:

- package.json
- react.js
- base configuration

Install the shared config inside the application.

```bash
pnpm add @repo/eslint-config@workspace:* --filter customer-portal
```

Verify the installed version.

```bash
pnpm list eslint
```

---

# 8. Fix Vite CSS Type Issues (If Required)

If CSS imports show TypeScript errors, create:

```text
apps/customer-portal/src/vite-env.d.ts
```

Add:

```ts
/// <reference types="vite/client" />
```

---

# 9. Configure Jest

Install Jest and Testing Library.

```bash
pnpm add -Dw \
jest \
jest-environment-jsdom \
ts-jest \
@types/jest \
@testing-library/react \
@testing-library/jest-dom \
@testing-library/user-event
```

Create a reusable Jest configuration package.

```text
packages/
└── jest-config/
```

Install the shared package.

```bash
pnpm add @repo/jest-config@workspace:* --filter customer-portal
```

Create:

```text
apps/customer-portal/jest.config.cjs
```

Create your first test.

Run the tests.

```bash
pnpm --filter customer-portal test
```

---

# 10. Configure CI Pipeline

Create the GitHub Actions workflow.

- refer the `.github/workflows` folder
---

# 11. Configure SonarCloud

Create a project in SonarCloud.

Generate a project token.

Add the token to GitHub Secrets.

```text
SONAR_TOKEN
```

Create the project configuration.

```text
sonar-project.properties
```

---

# 12. Configure Semantic Versioning

Install Semantic Release.

```bash
pnpm add -Dw \
semantic-release \
@semantic-release/changelog \
@semantic-release/commit-analyzer \
@semantic-release/git \
@semantic-release/github \
@semantic-release/release-notes-generator
```

Enable GitHub Actions permissions.

```
Repository
└── Settings
    └── Actions
        └── General
```

Ensure the following option is enabled:

```
Read and write permissions
```

Create the Semantic Release workflow.

```text
.github/workflows/release.yml
```

---

# 13. AWS Deployment Setup

## Create an IAM User

Grant the following permissions:

- AmazonS3FullAccess
- CloudFrontFullAccess

---

## Create an Access Key

Navigate to:

```
IAM
- Users
- Security credentials
- Create access key
- Application running outside AWS
```

Save:

- Access Key ID
- Secret Access Key

---

## Create an S3 Bucket

Create a bucket that will host the application.

---

## Configure CloudFront

Create a CloudFront distribution pointing to the S3 bucket.

Configure custom error pages:

| Error | Response Page |
|--------|---------------|
| 403 | `/index.html` |
| 404 | `/index.html` |

This enables React Router to work correctly.

---

## Configure GitHub Secrets

Add the following repository secrets.

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
S3_BUCKET_NAME
CLOUDFRONT_DISTRIBUTION_ID
```

---

## Configure the S3 Bucket Policy

Replace the bucket ARN and CloudFront Distribution ID with your own values.

```json
{
  "Version": "2008-10-17",
  "Id": "PolicyForCloudFrontPrivateContent",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*",
      "Condition": {
        "ArnLike": {
          "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
        }
      }
    }
  ]
}
```