FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY lib/rbac/package.json lib/rbac/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @workspace/api-server build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=8080
ENV PORT=8080

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/artifacts/api-server ./artifacts/api-server

EXPOSE 8080

CMD ["node", "artifacts/api-server/dist/index.cjs"]