# 💃 @queertangocollective/website

Run websites under Queer Tango Collective using handlebars for templating and minimal frontend JavaScript to improve search ranking on Google and complexities of a single page web application.

This app will run _all_ websites. The end goal is to synchronize / upload a Glitch app's assets to host templates, any client-side JavaScript, and styles.

## 🎛 Configuring

The configuration for this application is a connection string to Postgres, the database, and the port the application should run at.

```
PGCONNECTION=postgresql:///queertangocollective_dev
NODE_PORT=80
```