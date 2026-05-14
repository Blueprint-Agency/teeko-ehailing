FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json ./
RUN pnpm install --prod=false

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable
COPY package.json ./
# Install ALL deps (incl. drizzle-kit + tsx) so db:migrate / db:seed / db:postgis can run
# on deploy, AND so the server can run via tsx (avoids ERR_MODULE_NOT_FOUND from tsc
# emitting ESM imports without .js extensions). NODE_ENV is set after install so pnpm
# does not skip devDependencies.
RUN pnpm install
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY src ./src
COPY drizzle.config.ts tsconfig.json ./
EXPOSE 3000
CMD ["node_modules/.bin/tsx", "src/server.ts"]
