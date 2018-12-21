import { ObjectAnnotation } from '@atjson/document';

export default class Photo extends ObjectAnnotation {
  static vendorPrefix = 'qtc';
  static type = 'photo';
  attributes!: {
    url: string;
    width: number;
    height: number;
    caption: string;
    altText: string;
    size: 'small' | 'medium' | 'large' | undefined;
    align: 'left' | 'center' | 'right' | undefined;
  };

  get url() {
    return `https://${process.env['CLOUDFRONT_URL']}/${this.s3Key}`;
  }

  get s3Bucket() {
    return process.env['AWS_BUCKET_NAME'];
  }

  get s3Key() {
    return this.attributes.url
      .replace(`https://${process.env['CLOUDFRONT_URL']}/`, '')
      .replace(`https://${this.s3Bucket}.s3.amazonaws.com/`, '')
      .replace(/%2F/g, '/')
      .replace(/\+/g, ' ');
  }
}
