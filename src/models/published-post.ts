import * as knex from "knex";
import Group from "./group";
import Section from "./section";
import Photo from "./photo";
import Location from "./location";
import Event from "./event";
import Person from "./person";
import Ticket from "./ticket";

export default class PublishedPost {
  static db: knex;

  static async query(
    query: { slug: string; group: Group },
    includeRelationships: boolean
  ) {
    let [post] = await this.db
      .select()
      .from("published_posts")
      .limit(1)
      .where({
        slug: query.slug,
        group_id: query.group.id,
        live: true
      });

    if (post == null) {
      return null;
    }

    if (includeRelationships) {
      // Grab all rivers first
      let rivers: Array<{
        channelId: string;
        postIds: string[];
        featured: boolean;
      }> = JSON.parse(post.body).cards
        .filter((card: any[]) => card[0] === 'river')
        .map((card: any[]) => card[1]);

      let postIds: number[] = [];
      postIds = rivers.reduce((ids, river) => {
        if (river.postIds) {
          ids = ids.concat(river.postIds.map(id => parseInt(id, 10)));
        }
        return ids;
      }, postIds);

      let dynamicLists = rivers.filter(river => river.postIds == null || river.postIds.length === 0);

      let posts: PublishedPost[] = [];
      for (let i = 0, len = dynamicLists.length; i < len; i++) {
        let river = dynamicLists[i];
        let section = query.group.sections.find(section => section.id == parseInt(river.channelId, 10));
        let dynamicPosts = await PublishedPost.all({
          group: query.group,
          postId: post.id,
          featured: river.featured,
          section
        });

        if (dynamicPosts.length) {
          posts.push(...dynamicPosts.filter(post => posts.indexOf(post) === -1));
        }
      }

      postIds = postIds.filter(id => posts.find(post => post.id === id) == null);
      if (postIds.length) {
        posts = await PublishedPost.all({
          group: query.group,
          postId: post.id,
          postIds
        });
      }

      post.posts = posts;

      // Then grab all tickets
      let tickets = await this.db
        .select([
          "published_tickets.*",
          this.db.raw("to_json(tickets.*) as ticket")
        ])
        .from("published_tickets")
        .where({
          published_post_id: parseInt(post.id, 10)
        })
        .leftJoin("tickets", {
          ["tickets.id"]: "published_tickets.ticket_id"
        })
        .then(rows => {
          return rows.map((row: any) => row.ticket);
        });

      // Grab events
      let publishedEvents = await this.db
        .select()
        .from("published_events")
        .whereIn("published_post_id", [
          ...post.posts.map((post: any) => post.id),
          parseInt(post.id, 10)
        ]);

      let ticketedEvents: any[] = [];
      if (tickets.length) {
        ticketedEvents = await this.db
          .select()
          .from("ticketed_events")
          .whereIn("ticket_id", tickets.map((ticket: any) => ticket.id));

        tickets.forEach((ticket: any) => {
          ticket.ticketed_events = ticketedEvents.filter(
            (event: any) => event.ticket_id == ticket.id
          );
        });
      }

      let eventIds = [
        ...new Set([
          ...publishedEvents.map(
            (publishedEvent: any) => publishedEvent.event_id
          ),
          ...ticketedEvents.map((ticketedEvent: any) => ticketedEvent.event_id)
        ])
      ];

      let events = [];
      let guests: any[] = [];
      if (eventIds.length) {
        events = await this.db
          .select(["events.*", this.db.raw("to_json(venues.*) as venue")])
          .from("events")
          .where({
            group_id: query.group.id
          })
          .whereIn("events.id", eventIds)
          .leftJoin("venues", {
            "venues.id": "events.venue_id"
          })
          .orderBy([
            { column: "events.starts_at", order: "desc" },
            { column: "events.ends_at" }
          ]);

        guests = await this.db
          .select()
          .from("guests")
          .whereIn("event_id", eventIds);

        events.forEach((event: any) => {
          event.guests = guests.filter(
            (guest: any) => guest.event_id == event.id
          );
        });
      }

      // People
      let publishedPeople = await this.db
        .select()
        .from("published_people")
        .whereIn("published_post_id", [
          ...post.posts.map((post: any) => post.id),
          parseInt(post.id, 10)
        ]);

      let peopleIds = [
        ...new Set([
          ...guests.map((guest: any) => guest.person_id),
          ...publishedPeople.map(
            (publishedPerson: any) => publishedPerson.person_id
          )
        ])
      ];

      let people = [];
      if (peopleIds.length) {
        people = await this.db
          .select()
          .from("people")
          .where({
            group_id: query.group.id
          })
          .whereIn("id", peopleIds);
      }

      // Locations
      let publishedLocations = await this.db
        .select()
        .from("published_locations")
        .whereIn("published_post_id", [
          ...post.posts.map((post: any) => post.id),
          parseInt(post.id, 10)
        ]);

      let locationIds = [
        ...new Set([
          ...events
            .map((event: any) => event.venue)
            .filter((venue: any) => venue != null)
            .map((venue: any) => venue.location_id),
          ...publishedLocations.map(
            (publishedLocation: any) => publishedLocation.location_id
          )
        ])
      ];

      let locations = [];
      if (locationIds.length) {
        locations = await this.db
          .select()
          .from("locations")
          .where({
            group_id: query.group.id
          })
          .whereIn("id", locationIds);
      }

      // Photos
      let photos = await this.db
        .select([
          "published_photos.*",
          this.db.raw("to_json(photos.*) as photo")
        ])
        .from("published_photos")
        .whereIn("published_post_id", [
          ...post.posts.map((post: any) => post.id),
          parseInt(post.id, 10)
        ])
        .leftJoin("photos", {
          ["photos.id"]: "published_photos.photo_id"
        })
        .then(rows => {
          return rows.map((row: any) => row.photo);
        });

      post.tickets = tickets;
      post.people = people;
      post.events = events;
      post.photos = photos;
      post.locations = locations;
    }
    post.group = query.group;
    post.section = query.group.sections.find(
      section => post.channel_id == section.id
    );

    return new PublishedPost(post);
  }

  static async all(query: {
    section?: Section;
    featured?: boolean;
    postId: number;
    postIds?: number[];
    group: Group;
  }) {
    if (query.section) {
      let condition: { [key: string]: any } = {
        live: true,
        channel_id: query.section.id,
        group_id: query.group.id
      };
      if (query.featured) {
        condition.featured = true;
      }
      let river = await this.db
        .select()
        .from("published_posts")
        .whereNot({
          id: query.postId,
          slug: query.section.slug
        })
        .where(condition)
        .orderBy([
          { column: "featured", order: "desc" },
          { column: "created_at", order: "desc" }
        ]);

      river.forEach((item: any) => {
        item.group = query.group;
        item.section = query.group.sections.find(
          section => item.channel_id == section.id
        );
      });
  
      return river.map((post: any) => new PublishedPost(post)) as PublishedPost[];
    }

    if (query.featured) {
      let river = await this.db
        .select()
        .from("published_posts")
        .whereNot({
          id: query.postId
        })
        .where({
          live: true,
          group_id: query.group.id,
          featured: true
        })
        .orderBy([
          { column: "created_at", order: "desc" }
        ]);

      river.forEach((item: any) => {
        item.group = query.group;
        item.section = query.group.sections.find(
          section => item.channel_id == section.id
        );
      });

      return river.map((post: any) => new PublishedPost(post)) as PublishedPost[];
    }

    if (query.postIds) {
      let river = await this.db
        .select()
        .from("published_posts")
        .whereIn("post_id", query.postIds)
        .where({
          live: true,
          group_id: query.group.id
        });

      river.forEach((item: any) => {
        item.group = query.group;
        item.section = query.group.sections.find(
          section => item.channel_id == section.id
        );
      });

      return river.map((post: any) => new PublishedPost(post)) as PublishedPost[];
    }
    return [];
  }

  id: number;
  postId: number;
  title: string;
  slug: string;
  body: string;
  featured: boolean;
  section?: Section;
  photos: Photo[];
  locations: Location[];
  people: Person[];
  events: Event[];
  tickets: Ticket[];
  posts: PublishedPost[];
  group: Group;

  constructor(json: any) {
    this.group = json.group;
    this.title = json.title;
    this.slug = json.slug;
    this.body = json.body;
    this.section = json.section;
    this.featured = json.featured;
    this.id = json.id;
    this.postId = json.post_id;

    this.posts = json.posts;
    this.photos = (json.photos || []).map((photo: any) => new Photo(photo));
    this.locations = (json.locations || []).map(
      (location: any) => new Location(location)
    );
    this.people = (json.people || []).map((person: any) => new Person(person));
    this.events = (json.events || []).map(
      (event: any) => new Event(event, this.locations, this.people)
    );
    this.tickets = (json.tickets || []).map(
      (ticket: any) => new Ticket(ticket, this.events)
    );
  }
}
