import { config } from 'dotenv';
import * as knex from 'knex';
import website from './src/app';
import * as Sentry from '@sentry/node';

config();

let app = website(knex({
  client: 'pg',
  connection: process.env['PGCONNECTION']
}));

Sentry.init({ dsn: process.env['SENTRY_DSN'] });

let port = process.env['PORT'];
app.listen(port, () => {
  console.log(`ℹ️ Listening on port ${port}`);
});
