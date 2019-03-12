import { Annotation } from "@atjson/document";
import Renderer from "@atjson/renderer-hir";
import { readFileSync } from "fs";
import { join } from "path";
import { compile, registerHelper } from "handlebars";

registerHelper("equals", function(a: any, b: any) {
  return a === b;
});

registerHelper("image-url", function(url: string) {
  let s3Key = url
    .replace(`https://${process.env["CLOUDFRONT_URL"]}/`, "")
    .replace(`https://${process.env["AWS_BUCKET_NAME"]}.s3.amazonaws.com/`, "")
    .replace(/%2F/g, "/")
    .replace(/\+/g, " ");
  return `https://${process.env["CLOUDFRONT_URL"]}/${s3Key}`;
});

registerHelper("not", function(a: any) {
  return !a;
});

registerHelper("aspect-ratio", function(width: number, height: number) {
  return (height / width) * 100;
});

registerHelper("json", function(object: any) {
  return JSON.stringify(object);
});

registerHelper("add", function(a: number, b: number) {
  return a + b;
});

registerHelper("format-money", function(amount: number, currency: string, locale: string) {
  let formatter = Intl.NumberFormat(locale, { style: 'currency', currency });
  amount /= Math.pow(10, formatter.resolvedOptions().minimumFractionDigits);
  return formatter.format(amount);
});

registerHelper("is-last-item", function(list: any[], index: number) {
  return list.length - 1 === index;
});

registerHelper("format-repeating-event", function(
  json: Array<{ startsAt: string; endsAt: string; timeZone: string }>
) {
  let events = json
    .map(event => {
      let day = new Intl.DateTimeFormat("en-US", {
        timeZone: event.timeZone,
        weekday: "long"
      });

      let startsAt = new Date(Date.parse(event.startsAt));
      let endsAt = new Date(Date.parse(event.endsAt));

      return {
        startsAt,
        endsAt,
        timeZone: event.timeZone,
        dayOfWeek: day.format(startsAt),
        time:
          formatTime(startsAt, event.timeZone) +
          " - " +
          formatTime(endsAt, event.timeZone)
      };
    })
    .sort((a, b) => {
      if (a.startsAt < b.startsAt) {
        return -1;
      } else if (a.startsAt > b.startsAt) {
        return 1;
      }
      return 0;
    });

  let recurrences: { [key: string]: any } = {};
  events.forEach(event => {
    let time = event.dayOfWeek;
    if (recurrences[time] == null) {
      recurrences[time] = [];
    }
    recurrences[time].push(event);
  });

  return Object.keys(recurrences).map(recurrence => {
    let events = recurrences[recurrence];
    let firstEvent = events[0];
    let lastEvent = events[events.length - 1];

    if (events.length === 1) {
      return formatDateRange(
        firstEvent.startsAt,
        firstEvent.endsAt,
        firstEvent.timeZone
      );
    }
    if (
      isSameDay(firstEvent.startsAt, lastEvent.startsAt, firstEvent.timeZone)
    ) {
      return formatDateRange(
        firstEvent.startsAt,
        lastEvent.endsAt,
        firstEvent.timeZone
      );
    }

    let monthAndDay = new Intl.DateTimeFormat("en-US", {
      timeZone: firstEvent.timeZone,
      month: "short",
      day: "numeric"
    });
    let day = new Intl.DateTimeFormat("en-US", {
      timeZone: firstEvent.timeZone,
      day: "numeric"
    });
    if (
      isSameMonth(firstEvent.startsAt, lastEvent.startsAt, firstEvent.timeZone)
    ) {
      return `${firstEvent.dayOfWeek}s from ${
        firstEvent.time
      }, ${monthAndDay.format(firstEvent.startsAt)} - ${day.format(
        lastEvent.startsAt
      )}`;
    }
    return `${firstEvent.dayOfWeek}s from ${
      firstEvent.time
    }, ${monthAndDay.format(firstEvent.startsAt)} - ${monthAndDay.format(
      lastEvent.startsAt
    )}`;
  });
});

function formatTime(date: Date, timeZone: string) {
  if (date.getMinutes() > 0) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric"
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric"
  }).format(date);
}

function formatDay(date: Date, timeZone: string) {
  if (date.getMinutes() > 0) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      day: "numeric"
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    day: "numeric",
    hour: "numeric"
  }).format(date);
}

function formatFull(date: Date, timeZone: string) {
  if (date.getFullYear() === new Date().getFullYear()) {
    if (date.getMinutes() > 0) {
      return new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric"
      }).format(date);
    }
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric"
    }).format(date);
  } else {
    if (date.getMinutes() > 0) {
      return new Intl.DateTimeFormat("en-US", {
        timeZone,
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric"
      }).format(date);
    }
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "numeric"
    }).format(date);
  }
}

function isSameDay(a: Date, b: Date, timeZone: string) {
  let date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  return date.format(a) === date.format(b);
}

function isSameMonth(a: Date, b: Date, timeZone: string) {
  let date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "long"
  });
  return date.format(a) === date.format(b);
}

export function formatDateRange(start: Date, end: Date, timeZone: string) {
  if (isSameDay(start, end, timeZone)) {
    return formatFull(start, timeZone) + " - " + formatTime(end, timeZone);
  } else if (isSameMonth(start, end, timeZone)) {
    return formatFull(start, timeZone) + " - " + formatDay(end, timeZone);
  }
  return formatFull(start, timeZone) + " - " + formatFull(end, timeZone);
}

export default class HandlebarsRenderer extends Renderer {
  private assets: { [key: string]: string };

  constructor(assets?: any) {
    super();
    this.assets = assets || {};
  }

  templateFor(type: string) {
    return (
      this.assets[`views/${type}.hbs`] ||
      readFileSync(join(__dirname, "views/", `${type}.hbs`)).toString()
    );
  }

  *renderAnnotation(annotation: Annotation) {
    if (annotation.type !== "unknown") {
      let html = yield;
      let template = compile(this.templateFor(annotation.type));
      return template({
        yield: html.join(""),
        attrs: annotation.attributes
      });
    }
    let html = yield;
    return html.join("");
  }

  *root() {
    let html = yield;
    return html.join("");
  }
}
