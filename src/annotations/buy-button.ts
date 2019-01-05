import { ObjectAnnotation } from '@atjson/document';

export default class BuyButton extends ObjectAnnotation {
  static vendorPrefix = 'qtc';
  static type = 'buy-button';
  attributes!: {
    callToAction: string;
    code: string;
    cost: number;
    currency: string;
    events: Array<{
      id: string;
      name: string;
    }>;
  };
}