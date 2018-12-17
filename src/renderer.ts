import { Annotation } from '@atjson/document';
import Renderer from '@atjson/renderer-hir';
import { readFileSync } from 'fs';
import { join } from 'path';
import { compile, registerHelper } from 'handlebars';

registerHelper('equals', function(a, b) {
  return a === b;
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


function isSameDay(a: Date, b: Date) {
  let date = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  return date.format(a) === date.format(b);
}

function isSameMonth(a: Date, b: Date) {
  let date = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long'
  });
  return date.format(a) === date.format(b);
}

export function formatDateRange(start: Date, end: Date) {
  let long = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  });
  let time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric'
  });
  let day = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  });
  if (isSameDay(start, end)) {
    return long.format(start) + ' - ' + time.format(end);
  } else if (isSameMonth(start, end)) {
    return long.format(start) + ' - ' + day.format(end);
  }
  return long.format(start) + ' - ' + long.format(end);
}

export default class HandlebarsRenderer extends Renderer {
  *renderAnnotation(annotation: Annotation) {
    if (annotation.type !== 'unknown') {
      let html = yield;
      let template = compile(readFileSync(join(__dirname, 'views/', `${annotation.type}.hbs`)).toString());
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
    let template = compile(readFileSync(join(__dirname, 'views/root.hbs')).toString());
    return template({
      yield: html.join('')
    });
  }
}