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
try {
  console.log('Connecting to the database...');
  await client.connect();

  console.log('Loading group information...');

  // Verify the build by API Key
  let group = await client.query({
    text: 'SELECT * FROM groups WHERE api_key=$1',
    values: [secret]
  });
  console.log(`Found site configuration for ${group.hostname}.`);
} catch (e) {
  console.error('Could not load site', e);
}

app.get('/health', (req, res) => res.send('ok'));

app.get('*', function (req, res) {
  try {
    let build = await client.query({
      text: 'SELECT * FROM builds WHERE group_id=$1 AND live=True',
      values: [group.id]
    });

    // Re-insert the API key here for use in the frontend app
    let metaTag = new RegExp(`name="${process.env['APP_NAME']}/config/environment" content="(.*)"`);
    let html = build.html.replace(metaTag, function (encodedConfig) {
      let config = JSON.parse(decodeURIComponent(encodedConfig));
      config.API_KEY = process.env['API_KEY'];
      return encodeURIComponent(JSON.stringify(config));
    });

    res.send(html);
  } catch (e) {
    res.send(error);
  }
});
