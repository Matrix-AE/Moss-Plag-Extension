# Deploy Moss pair API (monorepo) for Railway / Docker.
FROM node:22-bookworm-slim

WORKDIR /app

# Only the API workspace + shared packages (skip extension; its postinstall needs wxt).
COPY package.json package-lock.json ./
COPY apps/api ./apps/api
COPY packages ./packages

# ignore-scripts: avoid any workspace postinstall hooks in the API image.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
  && node -e "require('./apps/api/server.js'); console.log('api-module-ok')"

ENV NODE_ENV=production
ENV MOSS_API_HOST=0.0.0.0
# Railway overrides PORT at runtime; default helps local docker runs.
ENV PORT=8080

EXPOSE 8080

CMD ["node", "apps/api/server.js"]
