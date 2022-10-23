FROM node:16-alpine
WORKDIR /dockerbuild
COPY ./ /dockerbuild
RUN npm install
RUN ["chmod", "+x", "./scripts/migrateAndStart.sh"]
ENTRYPOINT [ "./scripts/migrateAndStart.sh" ]
CMD [ "RUN" ]

EXPOSE 5000
