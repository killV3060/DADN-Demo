FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/iot-dashboard/package.json artifacts/iot-dashboard/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json

RUN pnpm install --frozen-lockfile

COPY . .

ARG WEB_PORT=4173
ARG BASE_PATH=/
ARG API_PORT=8080

ENV WEB_PORT=$WEB_PORT
ENV BASE_PATH=$BASE_PATH
ENV API_PORT=$API_PORT

RUN pnpm --filter @workspace/iot-dashboard build

FROM nginx:1.27-alpine AS runtime

COPY --from=base /app/artifacts/iot-dashboard/dist/public /usr/share/nginx/html
COPY artifacts/iot-dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]