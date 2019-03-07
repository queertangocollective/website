import * as crypto from "crypto";
import * as knex from "knex";
import Section from "./section";

export default class Group {
  static db: knex;

  static async query(query: { hostname: string | undefined }) {
    let [group] = await this.db
      .select([
        "groups.*",
        this.db.raw("to_json(websites.*) as website"),
        this.db.raw("to_json(builds.*) as build")
      ])
      .from("groups")
      .where(query)
      .leftJoin("websites", {
        "websites.id": "groups.current_website_id"
      })
      .leftJoin("builds", {
        "builds.id": "groups.current_build_id"
      });

    if (group) {
      group.channels = await this.db
        .select()
        .from("channels")
        .where({ group_id: group.id });
      return new Group(group);
    }
    return null;
  }

  id: number;
  applePayConfiguration?: string;
  hostname: string;
  locale: string;
  name: string;
  email?: string;
  sections: Section[];
  timezone: string;
  website?: {
    assets: { [key: string]: string };
  };
  build?: {
    id: number;
    git_sha: string;
    git_url: string;
    html: string;
  };
  encryptedStripePublishableKey: string;
  encryptedStripeSecretKey: string;

  constructor(json: any) {
    this.id = parseInt(json.id, 10);
    this.hostname = json.hostname;
    this.locale = json.locale;
    this.applePayConfiguration =
      json.apple_developer_merchantid_domain_association;
    this.name = json.name;
    this.email = json.email;
    this.website = json.website;
    this.sections = json.channels.map((channel: any) => new Section(channel));
    this.timezone = json.timezone;
    this.build = json.build;

    this.encryptedStripePublishableKey = json.encrypted_stripe_publishable_key;
    this.encryptedStripeSecretKey = json.encrypted_stripe_secret_key;
  }

  get stripePublishableKey() {
    return this.decrypt(this.encryptedStripePublishableKey);
  }

  get stripeSecretKey() {
    return this.decrypt(this.encryptedStripeSecretKey);
  }

  decrypt(signedData: string) {
    let privateKey = crypto.pbkdf2Sync(process.env['STRIPE_SECRET']!, process.env['STRIPE_SALT']!, 65536, 32, 'sha1');
    let value = new Buffer(signedData.split('--')[0], 'base64').toString();
    let [encryptedData, initializationVector] = value.split('--').map((data: string) => {
      return new Buffer(data, 'base64');
    });
    let cipher = crypto.createDecipheriv('aes-256-cbc', privateKey, initializationVector);
    let decryptedValue = cipher.update(encryptedData).toString();
    decryptedValue += cipher.final().toString();
    return decryptedValue.replace(/^\u0004\u0008I"%(.*)\u0006:\u0006ET$/g, '$1');
  }
}
