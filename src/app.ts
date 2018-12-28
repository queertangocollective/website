import * as express from 'express';
import QTCSource from './qtc-source';
import Renderer from './renderer';
import { readFileSync } from 'fs';
import { join } from 'path';
import { html } from 'js-beautify';
import { compile } from 'handlebars';
import { HIR } from '@atjson/hir';
import * as knex from 'knex';
import { Page } from './annotations';

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

  app.get('/.well-known/apple-developer-merchantid-domain-association', function (req, res) {
    db.select().from('groups').where({ hostname: req.get('host') }).then(([group]: any[]) => {
      if (group == null) return;
  
      console.log(`ℹ️ [${group.hostname}] Sending Apple Pay info`);
  
      res.set('Content-Type', 'text/plain');
      res.send(group.apple_developer_merchantid_domain_association);
    }, function (error) {
      res.send(error);
      console.error(error);
    });
  });

  app.get('*', async function (req, res) {
    if (req.path === '/home') {
      res.redirect(`${req.protocol}://${req.get('host')}`);
      return;
    }
    let [group] = await db.select().from('groups').where({ hostname: req.get('host') });
    if (group == null) {
      return;
    }
    let sections = await db.select().from('channels').where({ group_id: group.id });
    let slug = req.path.slice(1).replace(/\.json$/, '').replace(/\.html$/, '').replace(/\.hir$/, '') || 'home';
  
    try {
      let isJSON = req.path.match(/\.json$/);
      let isHIR = req.path.match(/\.hir$/);
      console.log(`ℹ️ [${group.hostname}] Loading post /${slug}`);

      let [post] = await db.select().from('posts').where({ slug, group_id: group.id, published: true });
      let doc = await QTCSource.fromRaw(db, group, post);
      let paragraph = [...doc.where({ type: '-offset-paragraph' }).sort()][0];
      let photo = [...doc.where({ type: '-qtc-photo' }).sort()][0];
      let section = sections.find((section: any) => section.id == post.channel_id);

      doc.addAnnotations(new Page({
        start: 0,
        end: doc.content.length,
        attributes: {
          locale: group.locale,
          title: post.title,
          description: paragraph ? doc.content.slice(paragraph.start, paragraph.end).trim() : null,
          url: `${req.protocol}://${group.hostname}/${slug}`,
          image: photo ? photo.attributes.url : null,
          section: section ? {
            slug: section.slug,
            name: section.name
          } : null,
          siteName: group.name,
          siteEmail: group.email,
          sections: sections.map((section: any) => {
            return {
              slug: section.slug,
              name: section.name
            }
          })
        }
      }));

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
            res.send(html(renderer.render(doc), {
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
    } catch (error) {
      console.log(`🚫 [${group.hostname}] Error loading ${slug}`, error);
      let template = compile(readFileSync(join(__dirname, 'views/404.hbs')).toString());
      res.status(404).send(html(template({
        attrs: {
          locale: group.locale,
          siteName: group.name,
          siteEmail: group.email,
          sections: sections.map((section: any) => {
            return {
              slug: section.slug,
              name: section.name
            }
          })
        }
      })));
    }
  });

  return app;
}
