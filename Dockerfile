FROM node:22 As dev
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=development
COPY . .
RUN npm run build

FROM node:22 As prod
ARG NODE_ENV=prod
ENV NODE_ENV=${NODE_ENV}
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY . .
COPY --from=development /usr/src/app/dist ./dist
CMD ["node", "dist/main.js"]