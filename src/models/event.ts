import Location from "./location";
import Person from "./person";

export default class Event {
  id: number;
  title: string;
  description: string;
  level: string;
  startsAt: Date;
  endsAt: Date;
  venue?: {
    location: Location;
    extendedAddress: string;
  };
  bylines: Array<{
    role: string;
    person: Person;
  }>;

  constructor(json: any, locations: Location[], people: Person[]) {
    this.id = json.id;
    this.title = json.title;
    this.description = json.description;
    this.level = json.level;
    this.startsAt = json.starts_at;
    this.endsAt = json.ends_at;
    if (json.venue) {
      this.venue = {
        location: locations.find(location => location.id == json.venue.location_id)!,
        extendedAddress: json.venue.extended_address
      };
    }
    this.bylines = json.guests.map((guest: any) => {
      return {
        role: guest.role,
        person: people.find(person => person.id == guest.person_id)!
      }
    });
  }
}
