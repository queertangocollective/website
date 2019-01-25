import Event from "./event";

export default class Ticket {
  id: number;
  description: string;
  quantity: number;
  cost: number;
  currency: string;
  validFrom: Date;
  validTo: Date;
  events: Event[];

  constructor(json: any, events: Event[]) {
    this.id = json.id;
    this.description = json.description;
    this.currency = json.currency;
    this.cost = json.cost;
    this.quantity = json.quantity;
    this.validFrom = json.valid_from;
    this.validTo = json.valid_to;
    this.events = json.ticketedEvents.map((ticketedEvent: any) => {
      return events.find(event => event.id == ticketedEvent.event_id);
    });
  }
}
