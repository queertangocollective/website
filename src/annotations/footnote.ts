import { BlockAnnotation } from '@atjson/document';

export default class Footnote extends BlockAnnotation {
  static vendorPrefix = 'qtc';
  static type = 'footnote';
}
