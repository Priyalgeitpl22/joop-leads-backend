############################
# Builder Stage
############################
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
COPY ecosystem.config.production.js ./

RUN npx prisma generate
RUN npm run build


############################
# Runtime Stage
############################
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

# copy built app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/ecosystem.config.production.js ./

# install pm2 globally
RUN npm install -g pm2

EXPOSE 5003

CMD sh -c "npx prisma migrate deploy && pm2-runtime start ecosystem.config.production.js"