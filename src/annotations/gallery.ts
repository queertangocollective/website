import { ObjectAnnotation } from "@atjson/document";

export default class Gallery extends ObjectAnnotation {
  static vendorPrefix = "qtc";
  static type = "gallery";
  attributes!: {
    photos: Array<{
      url: string;
      width: number;
      height: number;
      caption: string;
      altText: string;
    }>;
    size: "small" | "medium" | "large" | undefined;
    style: "mosaic" | undefined;
  };
}
