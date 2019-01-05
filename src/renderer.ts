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

registerHelper('format-repeating-event', function(json: Array<{ startsAt: string, endsAt: string, timeZone: string }>) {
  let events = json.map((event) => {
    let time = new Intl.DateTimeFormat('en-US', {
      timeZone: event.timeZone,
      hour: 'numeric',
      minute: 'numeric'
    });
    let day = new Intl.DateTimeFormat('en-US', {
      timeZone: event.timeZone,
      weekday: 'long'
    });

    let startsAt = new Date(Date.parse(event.startsAt));
    let endsAt = new Date(Date.parse(event.endsAt));
    return {
      startsAt,
      endsAt,
      timeZone: event.timeZone,
      dayOfWeek: day.format(startsAt),
      time: time.format(startsAt) + ' - ' + time.format(endsAt)
    };
  });

  let recurrences: { [key: string]: any } = {};
  events.forEach(event => {
    let time = `${event.dayOfWeek} from ${event.time}`;
    if (recurrences[time] == null) {
      recurrences[time] = [];
    }
    recurrences[time].push(event);
  });

  return Object.keys(recurrences).map(recurrence => {
    let events = recurrences[recurrence];
    let firstEvent = events[0];
    let lastEvent = events[events.length - 1];

    let monthAndDay = new Intl.DateTimeFormat('en-US', {
      timeZone: firstEvent.timeZone,
      month: 'long',
      day: 'numeric'
    });
    let day = new Intl.DateTimeFormat('en-US', {
      timeZone: firstEvent.timeZone,
      day: 'numeric'
    });
    if (isSameMonth(firstEvent.startsAt, lastEvent.startsAt, firstEvent.timeZone)) {
      return `${monthAndDay.format(firstEvent.startsAt)} - ${day.format(lastEvent.startsAt)}, every ${recurrence}`;
    }

    return `${monthAndDay.format(firstEvent.startsAt)} - ${monthAndDay.format(lastEvent.startsAt)}, every ${recurrence}`;
  });
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