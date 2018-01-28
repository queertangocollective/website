# @queertangocollective/app-loader

This application is designed to be a lightweight implementation of [front-end-builds](https://github.com/tedconf/front_end_builds). There are some tweaks made here to make the configuration match differences in where the managing application is hosted.

To run an application online using the app loader, you'll need to fill out the `.env` file for your production environment with the proper variables put in place:

```
PGUSER=my-pg-user
PGHOST=my-pg-host
PGPASSWORD=my-pg-password
PGDATABASE=my-pg-database
PGPORT=my-pg-port
API_KEY=my-api-key
APP_NAME=ember-app-name
```

The fields prefixed with `PG` are named for our database, postgres. We connect to the database to fetch the current builds that this app will use.

The `API_KEY` is a random string generated in [admin.queertangocollective.org](https://admin.queertangocollective.org), which you'll use in your app to get access to the API.

The `APP_NAME` is the name of the ember app. We use this to add extra configuration to the ember app when the application loads up on the page.
