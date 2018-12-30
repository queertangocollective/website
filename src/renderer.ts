import { Annotation } from '@atjson/document';
import Renderer from '@atjson/renderer-hir';
import { readFileSync } from 'fs';
import { join } from 'path';
import { compile, registerHelper } from 'handlebars';

registerHelper('equals', function(a, b) {
  return a === b;
});

registerHelper('image-url', function(url) {
  let s3Key = url.replace(`https://${process.env['CLOUDFRONT_URL']}/`, '')
                 .replace(`https://${process.env['AWS_BUCKET_NAME']}.s3.amazonaws.com/`, '')
                 .replace(/%2F/g, '/')
                 .replace(/\+/g, ' ');
  return `https://${process.env['CLOUDFRONT_URL']}/${s3Key}`;
});

registerHelper('not', function(a) {
  return !a;
});

registerHelper('aspect-ratio', function(width, height) {
  return (height / width) * 100;
});

registerHelper('is-last-item', function(list, index) {
  return list.length - 1 === index;
});


function isSameDay(a: Date, b: Date, timeZone: string) {
  let date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  return date.format(a) === date.format(b);
}

function isSameMonth(a: Date, b: Date, timeZone: string) {
  let date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'long'
  });
  return date.format(a) === date.format(b);
}

export function formatDateRange(start: Date, end: Date, timeZone: string) {
  let long = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  });
  let time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric'
  });
  let day = new Intl.DateTimeFormat('en-US', {
    timeZone,
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  });
  if (isSameDay(start, end, timeZone)) {
    return long.format(start) + ' - ' + time.format(end);
  } else if (isSameMonth(start, end, timeZone)) {
    return long.format(start) + ' - ' + day.format(end);
  }
  return long.format(start) + ' - ' + long.format(end);
}

export default class HandlebarsRenderer extends Renderer {
  private assets: { [key: string]: string };

  constructor(assets?: any) {
    super();
    this.assets = assets || {};
  }

  templateFor(type: string) {
    return this.assets[`views/${type}.hbs`] || 
      readFileSync(join(__dirname, 'views/', `${type}.hbs`)).toString();
  }

  *renderAnnotation(annotation: Annotation) {
    if (annotation.type !== 'unknown') {
      let html = yield;
      let template = compile(this.templateFor(annotation.type));
      return template({
        yield: html.join(''),
        attrs: annotation.attributes
      });
    }
    let html = yield;
    return html.join('');
  }

  *'root'() {
    let html = yield;
    return html.join('');
  }
}