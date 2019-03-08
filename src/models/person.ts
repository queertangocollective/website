import * as knex from 'knex';

export default class Person {
  static db: knex;

  static async create(params: { name: string, email: string }) {
    let person = await this.db('people').insert(params)

    if (person) {
      return new Person(person);
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
