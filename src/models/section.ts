export default class Section {
  id: number;
  slug: string;
  name: string;

  constructor(json: any) {
    this.id = json.id;
    this.name = json.name;
    this.slug = json.slug;
  }
}