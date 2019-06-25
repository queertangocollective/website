import Document, {
  ParseAnnotation,
  Annotation,
  AdjacentBoundaryBehaviour
} from "@atjson/document";
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
} from "@atjson/offset-annotations";
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
} from "./annotations";
import MobiledocSource, {
  PhotoCard,
  GalleryCard,
  ItineraryCard,
  PersonCard,
  LocationCard,
  Small,
  TicketCard,
  RiverCard
} from "./mobiledoc-source";
import { formatDateRange } from "./renderer";
import PublishedPost from "./models/published-post";
import PersonModel from "./models/person";
import EventModel from "./models/event";
import PhotoModel from "./models/photo";

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

  static async fromRaw(post: PublishedPost) {
    let doc = MobiledocSource.fromRaw(JSON.parse(post.body));
    if (post.slug !== "home") {
      doc.insertText(0, post.title + "\n");
      doc.addAnnotations(
        new ParseAnnotation({
          start: post.title.length,
          end: post.title.length + 1
        })
      );
      doc.addAnnotations(
        new Heading({
          start: 0,
          end: post.title.length + 1,
          attributes: {
            level: 1
          }
        })
      );
    }

    doc
      .where({ type: "-mobiledoc-p" })
      .where(a => a.start === a.end)
      .remove();

    doc.where({ type: "-mobiledoc-river-card" }).update((card: RiverCard) => {
      let posts = card.attributes.postIds && card.attributes.postIds.length
        ? card.attributes.postIds.map(id => {
          let item = post.posts.find(post => post.postId == parseInt(id, 10));
          return item!;
        }).filter(post => post != null)
        : post.posts.filter(post => {
          if (card.attributes.channelId) {
            if (card.attributes.featured) {
              return (
                parseInt(card.attributes.channelId, 10) ==
                (post.section && post.section.id)
              ) && post.featured;
            } else {
              return (
                parseInt(card.attributes.channelId, 10) ==
                (post.section && post.section.id)
              );
            }
          } else if (card.attributes.featured) {
            return post.featured;
          }
          return false;
        });

      doc.replaceAnnotation(
        card,
        new River({
          id: card.id,
          start: card.start,
          end: card.end,
          attributes: {
            posts: posts.map(item => {
              let postDoc = MobiledocSource.fromRaw(JSON.parse(item.body));
              postDoc
                .where({ type: "-mobiledoc-p" })
                .where(a => a.start === a.end)
                .remove();
              let paragraph = [
                ...postDoc.where({ type: "-mobiledoc-p" }).sort()
              ][0];
              let photoCard = [
                ...postDoc.where({ type: "-mobiledoc-photo-card" }).sort()
              ][0];
              let schedules = [
                ...postDoc.where({ type: "-mobiledoc-itinerary-card" })
              ];
              let photo = post.photos.find(
                photo => photo.id == (photoCard && photoCard.attributes.photoId)
              );
              let events: EventModel[] = schedules.reduce(
                (E: EventModel[], schedule: Schedule) => {
                  E.push(
                    ...schedule.attributes.eventIds.map((id: string) => {
                      return post.events.find(
                        event => event.id == parseInt(id, 10)
                      );
                    })
                  );
                  return E;
                },
                []
              );

              return {
                featured: item.featured,
                url: `/${item.slug}`,
                title: item.title,
                description: paragraph
                  ? postDoc.content.slice(paragraph.start, paragraph.end).trim()
                  : null,
                photo,
                events: events.map(event => {
                  return {
                    name: event.title,
                    startsAt: event.startsAt.toISOString(),
                    endsAt: event.endsAt.toISOString(),
                    timeZone: item.group.timezone,
                    location: event.venue ? {
                      name: event.venue.location.name,
                      latitude: event.venue.location.latitude,
                      longitude: event.venue.location.longitude
                    } : null
                  };
                })
              };
            })
          }
        })
      );
    });

    doc
      .where({ type: "-mobiledoc-ticket-card" })
      .update((ticketCard: TicketCard) => {
        let ticket = post.tickets.find((ticket: any) => {
          return ticketCard.attributes.ticketId.indexOf(ticket.id) !== -1;
        })!;

        let now = new Date();
        if (ticket.validFrom < now && now < ticket.validTo) {
          doc.replaceAnnotation(
            ticketCard,
            new BuyButton({
              start: ticketCard.start,
              end: ticketCard.start + 1,
              attributes: {
                code: `${post.group.code}-${ticket.id}`,
                callToAction: ticketCard.attributes.callToAction,
                locale: post.group.locale,
                description: ticket.description,
                cost: ticket.cost,
                currency: ticket.currency.toLowerCase(),
                stripeFee: ticket.stripeFee
              }
            })
          );
        }
      });

    doc
      .where({ type: "-mobiledoc-itinerary-card" })
      .update((itineraryCard: ItineraryCard) => {
        let events = post.events.filter((event: any) => {
          return itineraryCard.attributes.eventIds.indexOf(event.id) !== -1;
        });

        doc.insertText(itineraryCard.end, "\n");
        doc.replaceAnnotation(
          itineraryCard,
          new Schedule({
            start: itineraryCard.start,
            end: itineraryCard.start + 1,
            attributes: {
              events: events.map(event => {
                return {
                  name: event.title,
                  startsAt: event.startsAt.toISOString(),
                  endsAt: event.endsAt.toISOString(),
                  timeZone: post.group.timezone,
                  location: event.venue ? {
                    name: event.venue.location.name,
                    latitude: event.venue.location.latitude,
                    longitude: event.venue.location.longitude
                  } : null
                }
              })
            }
          })
        );

        events.forEach(event => {
          let start = itineraryCard.start + 1;
          let listItemStart = start;
          let end = start + event.title.length + 1;
          let annotations: Annotation[] = [];
          doc.insertText(start, event.title + "\n");
          doc.addAnnotations(
            new Heading({
              start,
              end: end - 1,
              attributes: {
                level: 4
              }
            })
          );
          start = end;

          let range = formatDateRange(
            event.startsAt,
            event.endsAt,
            post.group.timezone
          );
          end = start + range.length + 1;
          doc.insertText(start, range + "\n");
          annotations.push(
            new LineBreak({
              start: end - 1,
              end
            })
          );
          start = end;

          let groups: {
            [key: string]: Array<{ role: string; person: PersonModel }>;
          } = event.bylines.reduce((E: any, guest: any) => {
            if (E[guest.role] == null) {
              E[guest.role] = [];
            }
            E[guest.role].push(guest);
            return E;
          }, {});

          Object.keys(groups).forEach((byline: string) => {
            let bylines = groups[byline];
            doc.insertText(start, "\uFFFC\n");
            end = start + 2;
            annotations.push(
              new Byline({
                start,
                end: start + 1,
                attributes: {
                  byline,
                  people: bylines.map(byline => byline.person)
                }
              })
            );
            start = end;

            bylines.forEach(byline => {
              let peopleCards = doc
                .where({ type: "-mobiledoc-person-card" })
                .sort();
              if (
                peopleCards.where({
                  attributes: {
                    "-mobiledoc-personId": byline.person.id.toString()
                  }
                }).length === 0 &&
                byline.person.biography != null
              ) {
                let insertAt = doc.content.length;
                let behaviour = AdjacentBoundaryBehaviour.preserve;
                if (peopleCards.length > 0) {
                  insertAt = [...peopleCards][peopleCards.length - 1].end;
                  behaviour = AdjacentBoundaryBehaviour.default;
                }
                doc.insertText(insertAt, "\uFFFC\n", behaviour);
                doc.addAnnotations(
                  new PersonCard({
                    start: insertAt,
                    end: insertAt + 1,
                    attributes: {
                      personId: byline.person.id.toString()
                    }
                  })
                );
              }
            });
          });

          if (
            event.venue &&
            doc.where(
              a =>
                a.type === "location-card" &&
                a.attributes.locationId == event.venue!.location.id
            ).length === 0
          ) {
            let insertAt = doc.content.length;
            doc.insertText(
              insertAt,
              "\uFFFC\n",
              AdjacentBoundaryBehaviour.preserve
            );
            doc.addAnnotations(
              new LocationCard({
                start: insertAt,
                end: insertAt + 1,
                attributes: {
                  locationId: event.venue.location.id.toString()
                }
              })
            );
          }

          if (event.venue) {
            doc.insertText(start, "\uFFFC");
            end = start + 1;
            annotations.push(
              new LocationName({
                start,
                end: start + 1,
                attributes: {
                  id: event.venue.location.id.toString(),
                  name: event.venue.location.name,
                  extendedAddress:
                    event.venue.extendedAddress ||
                    event.venue.location.extendedAddress
                }
              })
            );
          }

          if (event.description) {
            start = end;
            let description = MobiledocSource.fromRaw(
              JSON.parse(event.description)
            );
            doc.insertText(start, description.content);
            description.annotations.forEach(a => {
              a.start += start;
              a.end += start;
              doc.addAnnotations(a);
            });
            end = start + description.content.length;
          }

          doc.addAnnotations(
            ...annotations,
            new ListItem({
              start: listItemStart,
              end
            })
          );
        });
      });

    doc.where({ type: "-mobiledoc-person-card" }).update((card: PersonCard) => {
      let person = post.people.find((person: any) => {
        return card.attributes.personId == person.id;
      })!;

      doc.insertText(card.end, "\n");
      doc.where({ id: card.id }).set({ end: card.start + 1 });

      let start = card.start + 1;
      if (person.name !== post.title) {
        doc.insertText(card.start + 1, person.name + "\n");
        doc.addAnnotations(
          new Heading({
            start: card.start + 1,
            end: card.start + 1 + person.name.length,
            attributes: {
              level: 3,
              sticky: true
            }
          })
        );
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
      doc
        .where({ id: card.id })
        .set({ type: "-qtc-person" })
        .rename({ attributes: { "-mobiledoc-personId": "-qtc-id" } });
    });

    doc
      .where({ type: "-mobiledoc-location-card" })
      .update((card: LocationCard) => {
        let location = post.locations.find(loc => {
          return parseInt(card.attributes.locationId, 10) == loc.id;
        });

        if (location) {
          doc.replaceAnnotation(
            card,
            new Location({
              start: card.start,
              end: card.end,
              attributes: {
                id: location.id,
                name: location.name,
                website: location.website,
                addressLine: location.addressLine,
                extendedAddress:
                  card.attributes.extendedAddress || location.extendedAddress,
                city: location.city,
                regionCode: location.regionCode,
                postalCode: location.postalCode,
                latitude: location.latitude,
                longitude: location.longitude
              }
            })
          );
        } else {
          doc.removeAnnotation(card);
        }
      });

    doc.where({ type: "-mobiledoc-photo-card" }).update((card: PhotoCard) => {
      let photo = post.photos.find(
        (photo: any) => photo.id == card.attributes.photoId
      );
      if (photo) {
        doc.replaceAnnotation(
          card,
          new Photo({
            start: card.start,
            end: card.end,
            attributes: {
              url: photo.url,
              width: photo.width,
              height: photo.height,
              altText: photo.altText,
              caption: card.attributes.caption,
              align: card.attributes.align,
              size: card.attributes.size
            }
          })
        );
      } else {
        doc.removeAnnotation(card);
      }
    });

    doc
      .where({ type: "-mobiledoc-gallery-card" })
      .update((galleryCard: GalleryCard) => {
        let photos = galleryCard.attributes.photoIds
          .map(photoId => {
            return post.photos.find(photo => photo.id == parseInt(photoId, 10));
          })
          .filter(model => model != null) as PhotoModel[];

        doc.replaceAnnotation(
          galleryCard,
          new Gallery({
            start: galleryCard.start,
            end: galleryCard.end,
            attributes: {
              photos: photos.map(photo => {
                return {
                  url: photo.url,
                  width: photo.width,
                  height: photo.height,
                  altText: photo.altText
                };
              }),
              style: 'mosaic',
              caption: galleryCard.attributes.caption,
              size: galleryCard.attributes.size
            }
          })
        );
      });

    doc.where({ type: "-mobiledoc-small" }).update((small: Small) => {
      let footnote = doc.slice(small.start, small.end);
      footnote.where({ start: 0, end: 0 }).remove();

      // Delete annotations that are in the footnote first
      doc.where(a => a.start >= small.start && a.end <= small.end).remove();
      doc.deleteText(small.start, small.end);

      let start = doc.content.length;
      let end = start + footnote.content.length;
      doc.insertText(
        start,
        footnote.content,
        AdjacentBoundaryBehaviour.preserve
      );
      doc.addAnnotations(new Footnote({ start, end }));
      footnote.annotations.forEach(a => {
        a.start += start;
        a.end += start;
        doc.addAnnotations(a);
      });
    });

    return new this(doc.convertTo(OffsetSource).toJSON());
  }
}
