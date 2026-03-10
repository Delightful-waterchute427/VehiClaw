FROM node:20-alpine

# Install build tools for better-sqlite3 native addon
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose UI port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "--loader", "ts-node/esm", "src/plugin/index.ts"]
