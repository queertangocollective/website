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
  app.get('/health', (req, res) => res.send('❤️'));

  app.get('*', function (req, res) {
    client.query({
      text: 'SELECT * FROM builds WHERE group_id=$1 AND live=True',
      values: [group.id]
    }).then(function (result) {
      let build = result.rows[0];
      res.send(build.html);
    }, function () {
      res.send(error);
    });
  });

  let port = process.env['PORT'];
  app.listen(port, function () {
    console.log(`Listening on port ${port}`);
  });
}).catch(function (e) {
  console.error('Could not load site', e);
});

