import * as knex from "knex";
import Event from "./event";

export default class Ticket {
  static db: knex;

  static async query(query: any) {
    let [ticket] = await this.db
      .select()
      .from("tickets")
      .where(query);

    if (ticket) {
      ticket.ticketed_events = await this.db
        .select()
        .from("ticketed_events")
        .where({ ticket_id: ticket.id });

      let events = await this.db
        .select()
        .from("events")
        .whereIn("events.id", ticket.ticketed_events.map((ticketedEvent: any) => {
          return ticketedEvent.event_id;
        }));

      return new Ticket(
        ticket,
        (events || []).map((event: any) => new Event(event, [], []))
      );
    }
    return null;
  }

  id: number;
  description: string;
  quantity: number;
  cost: number;
  currency: string;
  validFrom: Date;
  validTo: Date;
  events: Event[];

  get total() {
    return Math.round((this.cost + 30) / (1 - 0.029));
  }

  get stripeFee() {
    return this.total - this.cost;
  }

  constructor(json: any, events: Event[]) {
    this.id = json.id;
    this.description = json.description;
    this.currency = json.currency;
    this.cost = json.cost;
    this.quantity = json.quantity;
    this.validFrom = new Date(Date.parse(json.valid_from));
    this.validTo = new Date(Date.parse(json.valid_to));
    this.events = json.ticketed_events.map((ticketedEvent: any) => {
      return events.find(event => event.id == ticketedEvent.event_id);
    });
  }
}
