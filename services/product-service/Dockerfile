FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY services ./services
COPY packages ./packages
COPY infra ./infra

RUN npm ci
RUN npm run prisma:generate
RUN npm run build --workspace @ct/product-service

FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json /app/tsconfig.base.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/product-service/package.json ./services/product-service/package.json
COPY --from=builder /app/services/product-service/dist ./services/product-service/dist

CMD ["sh", "-c", "npm run prisma:migrate:deploy && node services/product-service/dist/main.js"]
