# Cloud Run production image for BabaSultan Restaurant ERP
# Build stage installs the full toolchain and compiles both the Vite frontend
# and the bundled Express backend. Runtime stage contains only production deps.
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/server.cjs"]
