FROM node:10

RUN apt-get install libpq-dev

WORKDIR /sequelize
VOLUME /sequelize

COPY . /sequelize
