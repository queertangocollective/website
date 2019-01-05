import Document, { ParseAnnotation, Annotation, AdjacentBoundaryBehaviour } from '@atjson/document';
import OffsetSource, {
  Blockquote,
  Bold,
  Heading,
  Italic,
  LineBreak,
  Link,
  List,
  ListItem,
  Paragraph,
  Underline,
  YouTubeEmbed
} from '@atjson/offset-annotations';
import {
  BuyButton,
  Byline,
  Gallery,
  Location,
  LocationName,
  Page,
  Person,
  PostEmbed,
  Photo,
  River,
  Schedule,
  Footnote
} from './annotations';
import MobiledocSource, { PhotoCard, GalleryCard, ItineraryCard, PersonCard, LocationCard, Small, TicketCard, RiverCard } from './mobiledoc-source';
import { formatDateRange } from './renderer';
import * as knex from 'knex';

function without<T>(array: T[], value: T): T[] {
  let result: T[] = [];
  return array.reduce((presentParts, part) => {
    if (part !== value) {
      presentParts.push(part);
    }
    return presentParts;
  }, result);
}

function compact<T>(array: T[]): NonNullable<T[]> {
  return without(without(array, null), undefined) as NonNullable<T[]>;
}

export default class QTCSource extends Document {
  static schema = [
    Blockquote,
    Byline,
    BuyButton,
    Bold,
    Heading,
    Italic,
    LineBreak,
    Link,
    List,
    ListItem,
    Page,
    Paragraph,
    Person,
    PostEmbed,
    Photo,
    Underline,
    YouTubeEmbed,
    Gallery,
    Location,
    LocationName,
    River,
    Schedule,
    Footnote
  ];

  static async fromRaw(db: knex, group: any, json: any) {
    let doc = MobiledocSource.fromRaw(JSON.parse(json.body));
    if (json.slug !== 'home') {
      doc.insertText(0, json.title + '\n');
      doc.addAnnotations(new ParseAnnotation({
        start: json.title.length,
        end: json.title.length + 1
      }));
      doc.addAnnotations(new Heading({
        start: 0,
        end: json.title.length + 1,
        attributes: {
          level: 1,
          channelId: json.channel_id
        }
      }));
    }

    doc.where({ type: '-mobiledoc-p' }).where(a => a.start === a.end).remove();

    let photoIds: string[] = [];
    let channelIds: string[] = [];
    let riverCards = [...doc.where({ type: '-mobiledoc-river-card' })];
    riverCards.forEach((river: RiverCard) => {
      channelIds.push(river.attributes.channelId);
    });

    if (channelIds.length) {
      let slugs = channelIds.map(channelId => {
        let channel = group.channels.find((channel: any) => channel.id == channelId);
        return channel.slug;
      });

      let allPosts = await db.select()
                          .from('posts')
                          .whereIn('channel_id', channelIds)
                          .whereNot('id', json.id)
                          .whereNotIn('slug', slugs)
                          .where({ group_id: group.id })
                          .orderBy([
                            { column: 'pinned', order: 'desc' },
                            { column: 'created_at', order: 'desc' }
                          ]);

      riverCards.forEach((riverCard: RiverCard) => {
        let posts = allPosts.filter((post: any) => {
          return riverCard.attributes.channelId == post.channel_id;
        });

        riverCard.attributes.posts = posts.map((post: any) => {
          let postDoc = MobiledocSource.fromRaw(JSON.parse(post.body));
          let paragraph = [...postDoc.where({ type: '-mobiledoc-p' }).sort()][0];
          let photo = [...postDoc.where({ type: '-mobiledoc-photo-card' }).sort()][0];
          let schedules = [...postDoc.where({ type: '-mobiledoc-itinerary-card' })];

          return {
            pinned: post.pinned,
            url: `/${post.slug}`,
            title: post.title,
            description: paragraph ? postDoc.content.slice(paragraph.start, paragraph.end).trim() : null,
            photoId: photo ? photo.attributes.photoId : null,
            eventIds: schedules.reduce((E: string[], schedule: Schedule) => {
              E.push(...schedule.attributes.eventIds.map((id: string) => parseInt(id, 10)));
              return E;
            }, [])
          }
        });
      });
    }

    let ticketIds: string[] = [];
    let ticketCards = doc.where({ type: '-mobiledoc-ticket-card' });
    [...ticketCards].forEach((ticket: TicketCard) => {
      ticketIds.push(ticket.attributes.ticketId);
    });

    if (ticketIds.length) {
      let allTickets = await db.select(['tickets.*', db.raw('to_json(ticketed_events.*) as events')])
                               .from('tickets')
                               .whereIn('id', ticketIds)
                               .where({ group_id: group.id })
                               .leftJoin('ticketed_events', {
                                 'ticketed_events.id': 'tickets.id'
                               });
      
      ticketCards.update((ticketCard: TicketCard) => {
        let ticket = allTickets.find((ticket: any) => {
          return ticketCard.attributes.ticketId.indexOf(ticket.id) !== -1;
        });

        doc.replaceAnnotation(ticketCard, new BuyButton({
          start: ticketCard.start,
          end: ticketCard.start + 1,
          attributes: {
            callToAction: ticketCard.attributes.callToAction,
            description: ticket.description,
            cost: ticket.cost,
            currency: ticket.currency,
            events: ticket.events
          }
        }));
      });
    }

    let eventIds: string[] = [];
    let itineraryCards = doc.where({ type: '-mobiledoc-itinerary-card' });
    [...itineraryCards].forEach((itinerary: ItineraryCard) => {
      eventIds.push(...itinerary.attributes.eventIds);
    });

    riverCards.forEach((riverCard: RiverCard) => {
      riverCard.attributes.posts.forEach((post: any) => {
        eventIds.push(...post.eventIds);
      });
    });

    if (eventIds.length) {
      let allEvents = await db.select(['events.*', db.raw('to_json(venues.*) as venue')])
                              .from('events')
                              .where({ group_id: group.id })
                              .whereIn('events.id', eventIds)
                              .leftJoin('venues', {
                                'venues.id': 'events.venue_id'
                              })
                              .orderBy([
                                { column: 'events.starts_at', order: 'desc' },
                                { column: 'events.ends_at' }
                              ]);
      let allGuests = await db.select().from('guests').whereIn('event_id', eventIds);

      riverCards.forEach((riverCard: RiverCard) => {
        riverCard.attributes.posts.forEach((post: any) => {
          post.events = post.eventIds.map((eventId: string) => {
            let event = allEvents.find((event: any) => event.id == eventId);
            return {
              startsAt: event.starts_at.toISOString(),
              endsAt: event.ends_at.toISOString(),
              timeZone: group.timezone
            }
          });
        });
      });

      allEvents.forEach((event: any) => {
        event.guests = allGuests.filter((guest: any) => {
          return guest.event_id == event.id;
        });
      });

      itineraryCards.update((itineraryCard: ItineraryCard) => {
        let events = allEvents.filter((event: any) => {
          return itineraryCard.attributes.eventIds.indexOf(event.id) !== -1;
        });

        doc.insertText(itineraryCard.end, '\n');
        doc.replaceAnnotation(itineraryCard, new Schedule({
          start: itineraryCard.start,
          end: itineraryCard.start + 1,
          attributes: {}
        }));

        events.forEach((event: any) => {
          let start = itineraryCard.start + 1;
          let listItemStart = start;
          let end = start + event.title.length + 1;
          let annotations: Annotation[] = []
          doc.insertText(start, event.title + '\n');
          doc.addAnnotations(new Heading({
            start ,
            end: end - 1,
            attributes: {
              level: 4
            }
          }));
          start = end;

          let range = formatDateRange(event.starts_at, event.ends_at, group.timezone);
          end = start + range.length + 1;
          doc.insertText(start, range + '\n');
          annotations.push(new LineBreak({
            start: end - 1,
            end
          }));
          start = end;

          let groups = event.guests.reduce((E: any, guest: any) => {
            if (E[guest.role] == null) {
              E[guest.role] = [];
            }
            E[guest.role].push(guest);
            return E;
          }, {});
          Object.keys(groups).forEach((byline: string) => {
            let guests = groups[byline];
            doc.insertText(start, '\uFFFC\n');
            end = start + 2;
            annotations.push(new Byline({
              start,
              end: start + 1,
              attributes: {
                byline,
                people: guests.map((guest: any) => guest.person_id)
              }
            }));
            start = end;

            guests.forEach((guest: any) => {
              let peopleCards = doc.where({ type: '-mobiledoc-person-card' }).sort();
              if (peopleCards.where({ attributes: { '-mobiledoc-personId': guest.person_id.toString() }}).length === 0) {
                let insertAt = doc.content.length;
                let behaviour = AdjacentBoundaryBehaviour.preserve;
                if (peopleCards.length > 0) {
                  insertAt = [...peopleCards][peopleCards.length - 1].end;
                  behaviour = AdjacentBoundaryBehaviour.default;
                }
                doc.insertText(insertAt, '\uFFFC\n', behaviour);
                doc.addAnnotations(new PersonCard({
                  start: insertAt,
                  end: insertAt + 1,
                  attributes: {
                    personId: guest.person_id
                  }
                }));
              }
            });
          });

          if (event.venue && doc.where(a => a.type === 'location-card' && a.attributes.locationId == event.venue.location_id).length === 0) {
            let insertAt = doc.content.length;
            doc.insertText(insertAt, '\uFFFC\n', AdjacentBoundaryBehaviour.preserve);
            doc.addAnnotations(new LocationCard({
              start: insertAt,
              end: insertAt + 1,
              attributes: {
                locationId: event.venue.location_id
              }
            }));
          }

          if (event.venue) {
            doc.insertText(start, '\uFFFC');
            end = start + 1;
            annotations.push(new LocationName({
              start,
              end: start + 1,
              attributes: {
                id: event.venue.location_id.toString(),
                extendedAddress: event.venue.extended_address
              }
            }));
          }

          if (event.description) {
            start = end;
            let description = MobiledocSource.fromRaw(JSON.parse(event.description));
            doc.insertText(start, description.content);
            description.annotations.forEach(a => {
              a.start += start;
              a.end += start;
              doc.addAnnotations(a);
            });
            end = start + description.content.length;
          }

          doc.addAnnotations(...annotations, new ListItem({
            start: listItemStart,
            end
          }));
        });
      });
    }

    let personIds: string[] = [];
    let personCards = doc.where({ type: '-mobiledoc-person-card' });
    [...personCards].forEach((person: PersonCard) => {
      personIds.push(person.attributes.personId);
    });

    if (personIds.length) {
      let allPeople = await db.select().from('people').where({ group_id: group.id }).whereIn('id', personIds);
      for (let card of personCards) {
        let person = allPeople.find((person: any) => {
          return card.attributes.personId === person.id;
        });

        doc.insertText(card.end, '\n');
        doc.where({ id: card.id }).set({ end: card.start + 1 });

        let start = card.start + 1;
        if (person.name !== json.title) {
          doc.insertText(card.start + 1, person.name + '\n');
          doc.addAnnotations(new Heading({
            start: card.start + 1,
            end: card.start + 1 + person.name.length,
            attributes: {
              level: 3,
              sticky: true
            }
          }));
          start += person.name.length + 1;
        }

        if (person.biography) {
          let bio = MobiledocSource.fromRaw(JSON.parse(person.biography));

          doc.insertText(start, bio.content);
          bio.annotations.forEach(a => {
            a.start += start;
            a.end += start;
            doc.addAnnotations(a);
          });
        }
        doc.deleteText(card.start, card.start + 1);
        doc.where({ id: card.id }).set({ type: '-qtc-person' }).rename({ attributes: { '-mobiledoc-personId': '-qtc-id' } });
      }
      doc.where({ type: '-qtc-byline' }).update((byline: any) => {
        let attrs = byline.attributes.attributes;
        let people = attrs['-qtc-people'].map((id: string) => {
          let person = allPeople.find((person: any) => id == person.id);
          return {
            id: person.id,
            name: person.name
          };
        });
        doc.replaceAnnotation(byline, new Byline({
          start: byline.start,
          end: byline.end,
          attributes: {
            byline: attrs['-qtc-byline'],
            people
          }
        }));
      });

    }

    let locationIds: string[] = [];
    let locationCards = doc.where({ type: '-mobiledoc-location-card' });
    [...locationCards].forEach((location: LocationCard) => {
      locationIds.push(location.attributes.locationId);
    });

    if (locationIds.length) {
      let allLocations = await db.select().from('locations').where({ group_id: group.id }).whereIn('id', compact(locationIds));
      for (let card of locationCards) {
        let location = allLocations.find((loc: any) => {
          return card.attributes.locationId == loc.id;
        });
        if (location) {
          doc.replaceAnnotation(card, new Location({
            start: card.start,
            end: card.end,
            attributes: {
              id: location.id,
              name: location.name,
              website: location.website,
              addressLine: location.address_line,
              extendedAddress: card.attributes.extendedAddress || location.extended_address,
              city: location.city,
              regionCode: location.region_code,
              postalCode: location.postal_code,
              latitude: location.latitude,
              longitude: location.longitude
            }
          }));

          doc.where({ type: '-qtc-location-name', attributes: { '-qtc-id': location.id } }).update(name => {
            doc.replaceAnnotation(name, new LocationName({
              start: name.start,
              end: name.end,
              attributes: {
                id: location.id,
                name: location.name,
                extendedAddress: name.attributes.attributes['-qtc-extendedAddress'] || location.extendedAddress
              }
            }))
          });
        } else {
          doc.removeAnnotation(card);
        }
      }
    }

    let photoCards = doc.where({ type: '-mobiledoc-photo-card' });
    let galleryCards = doc.where({ type: '-mobiledoc-gallery-card' });

    [...photoCards].forEach((photo: PhotoCard) => {
      photoIds.push(photo.attributes.photoId);
    });

    [...galleryCards].forEach((gallery: GalleryCard) => {
      photoIds.push(...gallery.attributes.photoIds);
    });

    riverCards.forEach((riverCard: RiverCard) => {
      riverCard.attributes.posts.forEach((post: any) => {
        if (post.photoId) {
          photoIds.push(post.photoId);
        }
      });
    });

    if (photoIds.length) {
      let allPhotos = await db.select().from('photos').where({ group_id: group.id }).whereIn('id', compact(photoIds));

      riverCards.forEach((riverCard: RiverCard) => {
        riverCard.attributes.posts.forEach((post: any) => {
          if (post.photoId) {
            let photo = allPhotos.find((photo: any) => photo.id == post.photoId);
            post.photo = {
              url: photo.url,
              width: photo.width,
              height: photo.height,
              altText: photo.title
            };
          }
        });
      });

      photoCards.update((photoCard: PhotoCard) => {
        let photo = allPhotos.find((photo: any) => photo.id === photoCard.attributes.photoId);
        if (photo) {
          doc.replaceAnnotation(photoCard, new Photo({
            start: photoCard.start,
            end: photoCard.end,
            attributes: {
              url: photo.url,
              width: photo.width,
              height: photo.height,
              altText: photo.title,
              caption: photoCard.attributes.caption,
              align: photoCard.attributes.align,
              size: photoCard.attributes.size
            }
          }));
        } else {
          doc.removeAnnotation(photoCard);
        }
      });

      galleryCards.update((galleryCard: GalleryCard) => {
        let photos = allPhotos.filter((photo: any) => {
          return galleryCard.attributes.photoIds.indexOf(photo.id) !== -1;
        });
        doc.replaceAnnotation(galleryCard, new Gallery({
          start: galleryCard.start,
          end: galleryCard.end,
          attributes: {
            photos: photos.map((photo: any) => {
              return {
                url: photo.url,
                width: photo.width,
                height: photo.height,
                altText: photo.title
              };
            }),
            style: galleryCard.attributes.style,
            size: galleryCard.attributes.size
          }
        }));
      });
    }

    doc.where({ type: '-qtc-post-embed' }).as('post').join(
      doc.where({ type: '-mobiledoc-h3' }).as('headings'),
      (a, b) => a.isAlignedWith(b)
    ).update(({ headings }) => {
      headings.forEach((heading) => {
        doc.removeAnnotation(heading);
      });
    });

    doc.where({ type: '-mobiledoc-small' }).update((small: Small) => {
      let footnote = doc.slice(small.start, small.end);
      footnote.where({ start: 0, end: 0 }).remove();

      // Delete annotations that are in the footnote first
      doc.where(a => a.start >= small.start && a.end <= small.end).remove();
      doc.deleteText(small.start, small.end);

      let start = doc.content.length;
      let end = start + footnote.content.length;
      doc.insertText(start, footnote.content, AdjacentBoundaryBehaviour.preserve);
      doc.addAnnotations(new Footnote({ start, end }));
      footnote.annotations.forEach(a => {
        a.start += start;
        a.end += start;
        doc.addAnnotations(a);
      });
    });

    doc.where({ type: '-mobiledoc-river-card' }).update((riverCard: RiverCard) => {
      doc.replaceAnnotation(riverCard, new River({
        start: riverCard.start,
        end: riverCard.end,
        attributes: {
          posts: riverCard.attributes.posts.map((post: any) => {
            delete post.photoId;
            delete post.eventIds;
            return post;
          })
        }
      }))
    });

    return new this(doc.convertTo(OffsetSource).toJSON());
  }
}
