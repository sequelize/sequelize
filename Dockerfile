FROM node:5

RUN apt-get install libpq-dev

WORKDIR /sequelize
COPY package.json /sequelize/
RUN npm install

COPY . /sequelize/
