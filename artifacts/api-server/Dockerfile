FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

# Native modules (bcrypt, serialport) need build toolchain
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

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

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
ENV API_PORT=8080
ENV PORT=8080

RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Workspace metadata + dependencies (drizzle-kit, bcrypt, pg, …)
COPY --from=base /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=base /app/node_modules ./node_modules

# DB schema push at container start (creates users + user_role enum)
COPY --from=base /app/lib/db ./lib/db
COPY --from=base /app/lib/rbac ./lib/rbac

# Built API bundle
COPY --from=base /app/artifacts/api-server/dist ./artifacts/api-server/dist

COPY artifacts/api-server/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "artifacts/api-server/dist/index.cjs"]
