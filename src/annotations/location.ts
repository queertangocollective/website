import { ObjectAnnotation } from '@atjson/document';

export default class Location extends ObjectAnnotation {
  static vendorPrefix = 'qtc';
  static type = 'location';
  attributes!: {
    name: string;
    city: string;
    website: string;
    addressLine: string;
    extendedAddress: string;
    regionCode: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  };
}
