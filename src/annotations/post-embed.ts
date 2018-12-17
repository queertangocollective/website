import { ObjectAnnotation } from '@atjson/document';

export default class PostEmbed extends ObjectAnnotation {
  static vendorPrefix = 'qtc';
  static type = 'post-embed';
  attributes!: {
    title: string;
    slug: string;
    photo: {
      url: string;
      altText: string;
      width: number;
      height: number;
    };
  };
}
