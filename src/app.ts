import * as express from 'express';
import QTCSource from './qtc-source';
import Renderer from './renderer';
import { readFileSync } from 'fs';
import { join } from 'path';
import { html } from 'js-beautify';
import { compile } from 'handlebars';
import { HIR } from '@atjson/hir';
import * as knex from 'knex';

export default function (db: knex) {
  let app = express();
  app.use(express.static('public'));

  app.use(function (req, res, next) {
    if ((!req.secure) && (req.headers['x-forwarded-proto'] === 'http')) {
      console.log(`🔒 Securing http://${req.get('host')}`);
      res.redirect(`https://${req.get('host')}${req.url}`);
    } else {
      next();
    }
  });

  app.get('/health', (_req, res) => {
    db.select('id').from('groups').then(() => {
      res.send('❤️');
    }, (error) => {
      console.error(error);
      res.status(500).send('💔');
    });
  });

  app.get('/robots.txt', function (req, res) {
    db.select().from('groups').where({ hostname: req.get('host') }).then(([group]: any[]) => {
      if (group == null) return;

      console.log(`ℹ️ [${group.hostname}] Requested robots.txt`);
      res.set('Content-Type', 'text/plain');
      res.send(`User-agent: *\nSitemap: ${req.protocol}://${group.hostname}/sitemap.xml`);
    }, function (error: Error) {
      res.send(error);
      console.error(error);
    });
  });

  app.get('/sitemap.xml', function (req, res) {
    db.select().from('groups').where({ hostname: req.get('host') }).then(([group]: any[]) => {
      if (group == null) return;

      console.log(`ℹ️ [${group.hostname}] Requested sitemap.xml`);
      return db.select('title', 'body', 'slug', 'updated_at').from('posts').where({
        group_id: group.id,
        published: true
      }).then((posts: any) => {
        let urls = posts.map((post: any) => {
          // Remove precise time from the url
          let updatedAt = post.updated_at.toISOString();
          let lastmod = updatedAt.slice(0, updatedAt.indexOf('T'));
          return `<url><loc>${req.protocol}://${group.hostname}/${post.slug}</loc><lastmod>${lastmod}</lastmod></url>`
        });
        res.set('Content-Type', 'text/xml');
        res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
      });
    }, function (error: Error) {
      res.send(error);
      console.error(error);
    });
  });
  /*
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
  });*/

  app.get('*', function (req, res) {
    if (req.path === '/home') {
      res.redirect(`${req.protocol}://${req.get('host')}`);
      return;
    }
    db.select().from('groups').where({ hostname: req.get('host') }).then(([group]: any[]) => {
      if (group == null) {
        return;
      }

      db.select().from('channels').where({ group_id: group.id }).then((sections: any[]) => {
        let slug = req.path.slice(1).replace(/\.json$/, '').replace(/\.html$/, '').replace(/\.hir$/, '') || 'home';
        let isJSON = req.path.match(/\.json$/);
        let isHIR = req.path.match(/\.hir$/);
        console.log(`ℹ️ [${group.hostname}] Loading post /${slug}`);

        db.select().from('posts').where({ slug }).then((posts: any) => {
          if (posts.length) {
            return QTCSource.fromRaw(db, posts[0]);
          } else {
            throw new Error('Not Found');
          }
        }).then((doc: QTCSource) => {
          res.format({
            'text/plain'() {
              res.send(doc.content);
            },
            'text/html'() {
              if (isJSON) {
                res.type('json');
                res.send(doc.toJSON());
              } else if (isHIR) {
                res.type('json');
                res.send(new HIR(doc).toJSON());
              } else {
                let renderer = new Renderer();
                let title = [...doc.where({ type: '-offset-heading', attributes: { '-offset-level': 1 } })][0];
                let paragraph = [...doc.where({ type: '-offset-paragraph' }).sort()][0];
                let photo = [...doc.where({ type: '-qtc-photo' }).sort()][0];
                let headline = doc.content.slice(title.start, title.end - 1);
                let body = renderer.render(doc);
                let template = compile(readFileSync(join(__dirname, 'views/index.hbs')).toString());
                res.send(html(template({
                  yield: body,
                  group: group,
                  post: {
                    title: headline,
                    description: paragraph ? doc.content.slice(paragraph.start, paragraph.end).trim() : null,
                    url: `${req.protocol}://${group.hostname}/${slug}`,
                    image: photo ? photo.attributes.url : null,
                    section: sections.find(section => section.id == title.attributes.channelId)
                  },
                  sections: sections
                }), {
                    unformatted: ['code', 'pre', 'em', 'strong', 'span', 'title'],
                    indent_inner_html: true,
                    indent_char: ' ',
                    indent_size: 2
                  }));
              }
            },
            'application/json'() {
              res.send(doc.toJSON());
            }
          });
        }, (error: Error) => {
          console.log(`🚫 [${group.hostname}] Error loading ${slug}`, error);
          let template = compile(readFileSync(join(__dirname, 'views/404.hbs')).toString());
          res.status(404).send(html(template({
            group: group,
            sections: sections
          })));
        });
      });
    });
  });

  return app;
}
