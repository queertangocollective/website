const express = require('express');
const crypto = require('crypto');

require('dotenv').config();

// Create a SHA512 hexdigest to find the group this app is for
const sha = crypto.createHash('SHA512');
sha.update(process.env['API_KEY']);
const secret = sha.digest('hex');

const { Client } = require('pg');
const client = new Client();

// Load current build of application from pg
console.log('Connecting to the database...');
client.connect().then(function () {

  console.log('Loading group information...');

  // Verify the build by API Key
  return client.query({
    text: 'SELECT * FROM groups WHERE api_key=$1',
    values: [secret]
  });
}).then(function (result) {
  let group = result.rows[0];
  console.log(`Found site configuration for ${group.hostname}.`);

  const app = express();
  app.get('/health', (req, res) => res.send('ok'));

  app.get('*', function (req, res) {
    client.query({
      text: 'SELECT * FROM builds WHERE group_id=$1 AND live=True',
      values: [group.id]
    }).then(function (result) {
      let build = result.rows[0];
      console.log(`Loaded build #${build.id}`);
      // Re-insert the API key here for use in the frontend app
      let metaTag = new RegExp(`name="${process.env['APP_NAME']}/config/environment" content="(.*)"`);
      let html = build.html.replace(metaTag, function (encodedConfig) {
        let config = JSON.parse(decodeURIComponent(encodedConfig));
        config.API_KEY = process.env['API_KEY'];
        return encodeURIComponent(JSON.stringify(config));
      });

      res.send(html);
    }, function () {
      res.send(error);
    });
  });

  let port = process.env['NODE_PORT'];
  app.listen(port, function () {
    console.log(`Listening on port ${port}`);
  });
}).catch(function () {
  console.error('Could not load site', e);
});

