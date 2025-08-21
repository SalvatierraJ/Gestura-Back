FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma/ ./prisma/

RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund

RUN npx prisma generate

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node package.json package-lock.json ./
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

RUN npm prune --omit=dev --no-audit --no-fund

COPY --chown=node:node prisma ./prisma

COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/main.js"]