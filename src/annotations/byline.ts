import { ObjectAnnotation } from "@atjson/document";

export default class Byline extends ObjectAnnotation {
  static vendorPrefix = "qtc";
  static type = "byline";
  attributes!: {
    byline: string;
    people: Array<{
      id: string;
      name: string;
    }>;
  };
}
