FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/

RUN npm ci --omit=dev --workspace=apps/api --workspace=packages/db --workspace=packages/shared

COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/api apps/api

EXPOSE 3000
CMD ["npx", "--workspace=apps/api", "tsx", "src/index.ts"]
