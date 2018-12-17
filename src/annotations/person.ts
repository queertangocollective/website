import { BlockAnnotation } from '@atjson/document';

export default class Person extends BlockAnnotation {
  static vendorPrefix = 'qtc';
  static type = 'person';
  attributes!: {
    id: string;
  };
}
