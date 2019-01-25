import { ObjectAnnotation } from '@atjson/document';

export default class River extends ObjectAnnotation {
  static vendorPrefix = 'qtc';
  static type = 'river';
  attributes!: {
    posts: Array<{
      featured: boolean;
      url: string;
      title: string;
      description: string;
      photo?: {
        url: string;
        altText: string;
        width: number;
        height: number;
      };
    }>;
  };
}
