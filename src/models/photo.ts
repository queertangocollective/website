export default class Photo {
  id: number;
  url: string;
  width: number;
  height: number;
  altText: string;

  constructor(json: any) {
    this.id = json.id;
    this.url = json.url;
    this.width = json.width;
    this.height = json.height;
    this.altText = json.title;
  }
}