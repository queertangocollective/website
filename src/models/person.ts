import * as knex from 'knex';
import Group from './group';

export default class Person {
  static db: knex;

  static async create(params: { group: Group, name: string, email: string }) {
    let person = await this.db('people').insert({
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      group_id: params.group.id,
      name: params.name,
      email: params.email
    }).returning('*');

    if (person.length) {
      return new Person(person[0]);
    }
    return null;
  }

  static async query(query: any) {
    let [person] = await this.db
      .select()
      .from("people")
      .where(query);

    if (person) {
      return new Person(person);
    }
    return null;
  }

  id: number;
  name: string;
  biography: string;
  website: string;

  constructor(json: any) {
    this.id = json.id;
    this.name = json.name;
    this.biography = json.biography;
    this.website = json.website;
  }
}
