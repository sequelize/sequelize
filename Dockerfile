FROM iojs:1.6

RUN apt-get install libpq-dev

COPY package.json /
RUN npm install

WORKDIR /sequelize
VOLUME /sequelize