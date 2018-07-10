const express = require('express');
const crypto = require('crypto');
const fs = require('fs');

require('dotenv').config();

// Create a SHA512 hexdigest to find the group this app is for
const sha = crypto.createHash('SHA512');
sha.update(process.env['API_KEY']);
const secret = sha.digest('hex');

const { Client } = require('pg');
const client = new Client();

const redirect = fs.readFileSync('redirect.html').toString();

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
  app.get('/torii/redirect.html', function (req, res) {
    res.send(redirect);
  });

  app.get('/sitemap.xml', function (req, res) {
    client.query({
      text: 'SELECT slug, updated_at FROM posts WHERE group_id=$1 and published=$2',
      values: [group.id, true]
    }).then((posts) => {
      let urls = posts.map((post) => {
        // Remove precise time from the url
        let lastmod = post.updated_at.slice(0, post.updated_at.indexOf('T'));
        return `<url><loc>${group.hostname}/${post.slug}</loc><lastmod>${lastmod}</lastmod></url>`
      });
      return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
    });
  });

  app.get('/.well-known/apple-developer-merchantid-domain-association', function (req, res) {
    res.send(group.apple_developer_merchantid_domain_association);
  });

  app.get('*', function (req, res) {
    client.query({
      text: 'SELECT * FROM builds WHERE group_id=$1 AND live=True',
      values: [group.id]
    }).then(function (result) {
      let build = result.rows[0];
      res.send(build.html.replace('%7B%7Bbuild.id%7D%7D', build.id));
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

