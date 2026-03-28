FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY services ./services
COPY packages ./packages
COPY infra ./infra

RUN npm ci
RUN npm run prisma:generate
RUN npm run build --workspace @ct/review-processor-service

FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json /app/tsconfig.base.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/review-processor-service/package.json ./services/review-processor-service/package.json
COPY --from=builder /app/services/review-processor-service/dist ./services/review-processor-service/dist

CMD ["sh", "-c", "npm run prisma:migrate:deploy && node services/review-processor-service/dist/main.js"]
