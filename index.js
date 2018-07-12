const express = require('express');
const fs = require('fs');

require('dotenv').config();

const { Client } = require('pg');
const client = new Client();

const redirect = fs.readFileSync('redirect.html').toString();

// Load current build of application from pg
console.log('Connecting to the database...');
client.connect().then(function () {
  const app = express();
  app.get('/health', (req, res) => res.send('❤️'));
  app.get('/torii/redirect.html', function (req, res) {
    res.send(redirect);
  });

  app.get('/sitemap.xml', function (req, res) {
    console.log('Loading group information...');

    return client.query({
      text: 'SELECT id FROM groups WHERE hostname=$1',
      values: [req.headers.host]
    }).then(() => {
      let group = result.rows[0];
      console.log(`Found site configuration for ${req.headers.host}.`);

      return client.query({
        text: 'SELECT slug, updated_at FROM posts WHERE group_id=$1 and published=True',
        values: [group.id]
      });
    }).then((result) => {
      let urls = result.rows.map((post) => {
        // Remove precise time from the url
        let updatedAt = post.updated_at.toISOString();
        let lastmod = updated_at.slice(0, updated_at.indexOf('T'));
        return `<url><loc>${group.hostname}/${post.slug}</loc><lastmod>${lastmod}</lastmod></url>`
      });
      res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
    }, function () {
      res.send(error);
    });
  });

  app.get('/.well-known/apple-developer-merchantid-domain-association', function (req, res) {
    console.log('Loading group information...');

    return client.query({
      text: 'SELECT apple_developer_merchantid_domain_association FROM groups WHERE hostname=$1',
      values: [req.headers.host]
    }).then(() => {
      let group = result.rows[0];
      console.log(`Sending Apple Pay info for ${req.headers.host}.`);
      res.send(group.apple_developer_merchantid_domain_association);
    }, function () {
      res.send(error);
    });
  });

  app.get('*', function (req, res) {
    console.log('Loading group information...');

    return client.query({
      text: 'SELECT current_build_id FROM groups WHERE hostname=$1',
      values: [req.headers.host]
    }).then(() => {
      let group = result.rows[0];
      console.log(`Loading build for ${req.headers.host}.`);
      res.send(group.apple_developer_merchantid_domain_association);

      return client.query({
        text: 'SELECT * FROM builds WHERE id=$1',
        values: [group.current_build_id]
      });
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
  console.error('Could connect to database', e);
});

