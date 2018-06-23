FROM node:6

RUN apt-get install libpq-dev

WORKDIR /sequelize
VOLUME /sequelize

COPY . /sequelize
