FROM node:22 As dev
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=development
COPY . .
CMD ["npm", "run", "start:dev"]

FROM node:22 As prod
ARG NODE_ENV=prod
ENV NODE_ENV=${NODE_ENV}
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY . .
RUN npm run build
CMD ["node", "dist/main.js"]