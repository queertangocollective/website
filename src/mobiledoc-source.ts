import MobiledocSource from '@atjson/source-mobiledoc';
import { ObjectAnnotation, BlockAnnotation } from '@atjson/document';
import OffsetSource, { LineBreak } from '@atjson/offset-annotations';

export class GalleryCard extends ObjectAnnotation {
  static vendorPrefix = 'mobiledoc';
  static type = 'gallery-card';
  attributes!: {
    style: string;
    size: string;
    photoIds: string[];
  };
}

export class ItineraryCard extends ObjectAnnotation {
  static vendorPrefix = 'mobiledoc';
  static type = 'itinerary-card';
  attributes!: {
    eventIds: string[];
  };
}

export class LocationCard extends ObjectAnnotation {
  static vendorPrefix = 'mobiledoc';
  static type = 'location-card';
  attributes!: {
    locationId: string;
    extendedAddress: string;
  };
}

export class PersonCard extends ObjectAnnotation {
  static vendorPrefix = 'mobiledoc';
  static type = 'person-card';
  attributes!: {
    personId: string;
  };
}

export class PhotoCard extends ObjectAnnotation {
  static vendorPrefix = 'mobiledoc';
  static type = 'photo-card';
  attributes!: {
    photoId: string;
    align: string;
    caption: string;
    size: string;
  };
}

export class TicketCard extends ObjectAnnotation {
  static vendorPrefix = 'mobiledoc';
  static type = 'ticket-card';
  attributes!: {
    ticketId: string;
    callToAction: string;
  };
}

export class Small extends BlockAnnotation {
  static vendorPrefix = 'mobiledoc';
  static type = 'small';
}

export default class QTCMobiledocSource extends MobiledocSource {
  static schema = [
    ...MobiledocSource.schema,
    GalleryCard,
    ItineraryCard,
    LocationCard,
    PersonCard,
    PhotoCard,
    TicketCard,
    LineBreak,
    Small
  ];
}

QTCMobiledocSource.defineConverterTo(OffsetSource, doc => {
  doc.where({ type: '-mobiledoc-line-break-atom' }).set({ type: '-offset-line-break' });
  return doc.convertTo(MobiledocSource).convertTo(OffsetSource);
});
