export default class Person {
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
