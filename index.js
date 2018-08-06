const express = require('express');
const fs = require('fs');

require('dotenv').config();

const { Client } = require('pg');
const client = new Client();

const redirect = fs.readFileSync('redirect.html').toString();

function getGroup(req, res) {
  return client.query({
    text: 'SELECT * FROM groups WHERE hostname=$1',
    values: [req.headers.host]
  }).then((result) => {
    if (result.rows.length == 0) {
      console.error(`⚠️ No group found for ${req.headers.host}`);
      res.send('');
      return null;
    }
    return result.rows[0];
  });
}

// Load current build of application from pg
console.log('Connecting to the database...');
client.connect().then(function (result) {
  const app = express();
  app.use(function(req, res, next) {
    if ((!req.secure) && (req.headers['x-forwarded-proto'] === 'http')) {
      console.log(`🔒 Securing http://${req.headers.host}`);
      res.redirect(`https://${req.headers.host}${req.url}`);
    } else {
      next();
    }
  });

  app.get('/health', (req, res) => res.send('❤️'));
  app.get('/torii/redirect.html', function (req, res) {
    res.send(redirect);
  });

  app.get('/sitemap.xml', function (req, res) {
    getGroup(req, res).then((group) => {
      if (group == null) return;

      console.log(`ℹ️ [${group.hostname}] Creating sitemap.xml`);
      return client.query({
        text: 'SELECT slug, updated_at FROM posts WHERE group_id=$1 and published=True',
        values: [group.id]
      });
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
    getGroup(req, res).then((group) => {
      if (group == null) return;

      console.log(`ℹ️ [${group.hostname}] Sending Apple Pay info`);

      res.set('Content-Type', 'text/plain');
      res.send(group.apple_developer_merchantid_domain_association);
    }, function (error) {
      res.send(error);
      console.error(error);
    });
  });

  app.get('*', function (req, res) {
    getGroup(req, res).then((group) => {
      if (group == null) return;

      console.log(`ℹ️ [${group.hostname}] Loading current build ${group.current_build_id}`);

      return client.query({
        text: 'SELECT * FROM builds WHERE id=$1',
        values: [group.current_build_id]
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
