import { config } from 'dotenv';
import * as knex from 'knex';
import website from './src/app';

config();

let app = website(knex({
  client: 'pg',
  connection: process.env['PGCONNECTION']
}));

let port = process.env['PORT'];
app.listen(port, () => {
  console.log(`ℹ️ Listening on port ${port}`);
});
