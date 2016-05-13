FROM node:5

RUN apt-get install libpq-dev

COPY package.json /
RUN npm install

WORKDIR /sequelize
VOLUME /sequelize
