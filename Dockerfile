# Deploy Moss pair API (monorepo) for Railway / Docker.
# If Railway build logs still show only `RUN npm ci --omit=dev`, you are on an OLD image — redeploy main.
FROM node:22-bookworm-slim

WORKDIR /app

ENV MOSS_API_IMAGE_REV=2026-08-04-healthfix2

# Only the API workspace + shared packages (skip extension; its postinstall needs wxt).
COPY package.json package-lock.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN echo "building moss-pair-api ${MOSS_API_IMAGE_REV}" \
  && npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
  && node -e "require('./apps/api/server.js'); console.log('api-module-ok')"

ENV NODE_ENV=production
ENV MOSS_API_HOST=0.0.0.0
# Railway overrides PORT at runtime; default helps local docker runs.
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "echo moss-pair-api-boot rev=$MOSS_API_IMAGE_REV port=$PORT && exec node apps/api/server.js"]
