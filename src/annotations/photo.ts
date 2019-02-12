import { ObjectAnnotation } from "@atjson/document";

export default class Photo extends ObjectAnnotation {
  static vendorPrefix = "qtc";
  static type = "photo";
  attributes!: {
    url: string;
    width: number;
    height: number;
    caption: string;
    altText: string;
    size: "small" | "medium" | "large" | undefined;
    align: "left" | "center" | "right" | undefined;
  };
}
