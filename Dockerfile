FROM node:lts-slim

WORKDIR /usr/src/app

COPY package*.json  ./

RUN yarn

EXPOSE 3000

CMD [ "yarn", "start" ]