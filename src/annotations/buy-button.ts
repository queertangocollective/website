import { ObjectAnnotation } from "@atjson/document";

export default class BuyButton extends ObjectAnnotation {
  static vendorPrefix = "qtc";
  static type = "buy-button";
  attributes!: {
    callToAction: string;
    code: string;
    cost: number;
    locale: string;
    currency: string;
    description: string;
    stripeFee: number;
    events: Array<{
      id: number;
      name: string;
    }>;
  };
}
