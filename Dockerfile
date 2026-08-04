# Deploy Moss pair API (monorepo) for Railway / Docker.
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN npm ci --omit=dev

ENV NODE_ENV=production
ENV MOSS_API_HOST=0.0.0.0

# Railway injects PORT; server.js reads PORT / MOSS_API_PORT.
EXPOSE 8787

CMD ["npm", "run", "start", "--workspace", "@moss/api"]
