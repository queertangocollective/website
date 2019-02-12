export default class Section {
  id: number;
  slug: string;
  name: string;

  constructor(json: any) {
    this.id = parseInt(json.id, 10);
    this.name = json.name;
    this.slug = json.slug;
  }
}
