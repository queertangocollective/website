const express = require('express');
const fs = require('fs');

require('dotenv').config();

const { Client } = require('pg');
const client = new Client();

const redirect = fs.readFileSync('redirect.html').toString();

// Load current build of application from pg
console.log('Connecting to the database...');
client.connect().then(function () {
  return client.query({
    text: 'SELECT hostname, id FROM groups'
  });
}).then(function (result) {
  let groups = result.rows;
  let hostnames = groups.map((group) => group.hostname);

  const app = express();
  app.get('/health', (req, res) => res.send('❤️'));
  app.get('/torii/redirect.html', function (req, res) {
    res.send(redirect);
  });

  app.get('/sitemap.xml', function (req, res) {
    let group = groups.find((group) => group.hostname === req.headers.host);
    if (group == null) {
      console.error(`⚠️  No group found for ${req.headers.host}`);
      res.send('');
      return;
    }
    console.log(`ℹ️  [${group.hostname}] Creating sitemap.xml`);

    return client.query({
      text: 'SELECT slug, updated_at FROM posts WHERE group_id=$1 and published=True',
      values: [group.id]
    }).then((result) => {
      let urls = result.rows.map((post) => {
        // Remove precise time from the url
        let updatedAt = post.updated_at.toISOString();
        let lastmod = updatedAt.slice(0, updatedAt.indexOf('T'));
        return `<url><loc>${group.hostname}/${post.slug}</loc><lastmod>${lastmod}</lastmod></url>`
      });
      res.set('Content-Type', 'text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
    }, function (error) {
      res.send(error);
      console.error(error);
    });
  });

  app.get('/.well-known/apple-developer-merchantid-domain-association', function (req, res) {
    let group = groups.find((group) => group.hostname === req.headers.host);
    if (group == null) {
      console.error(`⚠️  No group found for ${req.headers.host}`);
      res.send('');
      return;
    }

    return client.query({
      text: 'SELECT apple_developer_merchantid_domain_association FROM groups WHERE id=$1',
      values: [group.id]
    }).then((result) => {
      console.log(`ℹ️  [${group.hostname}] Sending Apple Pay info`);

      res.set('Content-Type', 'text/plain');
      res.send(result.rows[0].apple_developer_merchantid_domain_association);
    }, function (error) {
      res.send(error);
      console.error(error);
    });
  });

  app.get('*', function (req, res) {
    let group = groups.find((group) => group.hostname === req.headers.host);
    if (group == null) {
      console.error(`⚠️  No group found for ${req.headers.host}`);
      res.send('');
      return;
    }

    return client.query({
      text: 'SELECT current_build_id FROM groups WHERE id=$1',
      values: [group.id]
    }).then((result) => {
      console.log(`ℹ️  [${group.hostname}] Loading current build ${result.rows[0].current_build_id}`);

      return client.query({
        text: 'SELECT * FROM builds WHERE id=$1',
        values: [result.rows[0].current_build_id]
      });
    }).then(function (result) {
      let build = result.rows[0];
      res.send(build.html.replace('%7B%7Bbuild.id%7D%7D', build.id));
    }, function (error) {
      res.send(error);
      console.error(error);
    });
  });

  let port = process.env['PORT'];
  app.listen(port, function () {
    console.log(`Listening on port ${port}`);
  });
}).catch(function (e) {
  console.error('Could connect to database', e);
});

