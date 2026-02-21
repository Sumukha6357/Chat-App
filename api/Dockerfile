# Base stage for dependencies
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Development stage
FROM base AS development
COPY . .
# We don't run build here to allow for hot-reloading in local development
CMD ["npm", "run", "start:dev"]

# Build stage for production
FROM base AS build
COPY . .
RUN npm run build

# Production runner stage
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
