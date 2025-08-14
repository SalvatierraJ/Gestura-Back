# ---------- BUILDER: instala devDeps y compila TypeScript ----------
FROM node:22-bookworm-slim AS builder
ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

# 1) Instalar TODAS las dependencias (incluye dev) para poder compilar
COPY package*.json ./
RUN npm install

# 2) Copiar el resto del código (incluye tsconfig.json, tsconfig.build.json, nest-cli.json, etc.)
COPY . .

# 3) Prisma (si lo usas): genera el cliente (tipos + runtime)
RUN npx prisma generate

# 4) Compilar Nest a /app/dist
RUN npm run build

# ---------- RUNNER: sólo prod + Chromium para Puppeteer ----------
FROM node:22-bookworm-slim AS runner
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true

# Chromium y libs necesarias para Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Sólo deps de producción para ejecutar dist/
COPY package*.json ./
RUN npm install --omit=dev

# Copiar artefactos compilados y prisma generada desde el builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Usuario no root
RUN chown -R node:node /app
USER node

# Arranque: ejecuta el JS compilado (no TypeScript)
CMD ["node", "dist/main.js"]
