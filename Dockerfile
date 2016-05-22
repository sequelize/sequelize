FROM node:5

RUN apt-get install libpq-dev
RUN npm install jshint -g
RUN npm install mocha -g

COPY package.json /
RUN npm install

WORKDIR /sequelize
VOLUME /sequelize
