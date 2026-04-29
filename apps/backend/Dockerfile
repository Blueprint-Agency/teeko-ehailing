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
ENV NODE_ENV=production
RUN corepack enable
COPY package.json ./
RUN pnpm install --prod
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
EXPOSE 3000
CMD ["node", "dist/server.js"]
