FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node server.js serverStatistics.js ./
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/sounds ./sounds

RUN mkdir -p /app/saves /app/site-content/uploads /app/statistics && chown -R node:node /app/saves /app/site-content /app/statistics

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 3000

USER node

CMD ["npm", "start"]
