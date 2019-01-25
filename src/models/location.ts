export default class Location {
  id: number;
  name: string;
  addressLine: string;
  extendedAddress: string;
  city: string;
  regionCode: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  website: string;

  constructor(json: any) {
    this.id = json.id;
    this.name = json.name;
    this.addressLine = json.address_line;
    this.extendedAddress = json.extended_address;
    this.city = json.city;
    this.regionCode = json.region_code;
    this.postalCode = json.postal_code;
    this.latitude = json.latitude;
    this.longitude = json.longitude;
    this.website = json.website;
  }
}
