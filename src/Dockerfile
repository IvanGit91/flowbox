FROM node:16

ARG MACHINE

WORKDIR /usr/src/app
COPY package*.json ./

RUN if [ "$MACHINE" = "dev" ]; then \
 npm i; \
    else \
 npm ci --only=production; \
fi

COPY . .

RUN mkdir -p /usr/src/app/storage
#RUN chown node:node /usr/src/app
#RUN chown node:node /usr/src/app/storage
#USER node
