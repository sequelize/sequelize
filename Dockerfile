FROM node:4

RUN apt-get install libpq-dev

COPY package.json /
ENV NPM_CONFIG_LOGLEVEL error
RUN npm install

WORKDIR /sequelize
VOLUME /sequelize
