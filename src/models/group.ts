import * as knex from 'knex';
import Section from './section';

export default class Group {
  static db: knex;

  static async query(query: { hostname: string | undefined }) {
    let [group] = await this.db.select([
      'groups.*',
      this.db.raw('to_json(websites.*) as website'),
      this.db.raw('to_json(builds.*) as build')
    ]).from(
      'groups'
    ).where(
      query
    ).leftJoin('websites', {
      'websites.id': 'groups.current_website_id'
    }).leftJoin('builds', {
      'builds.id': 'groups.current_build_id'
    });
    
    if (group) {
      group.channels = await this.db.select().from('channels').where({ group_id: group.id });
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

  constructor(json: any) {
    this.id = parseInt(json.id, 10);
    this.hostname = json.hostname;
    this.locale = json.locale;
    this.applePayConfiguration = json.apple_developer_merchantid_domain_association;
    this.name = json.name;
    this.email = json.email;
    this.website = json.website;
    this.sections = json.channels.map((channel: any) => new Section(channel));
    this.timezone = json.timezone;
    this.build = json.build;
  }
}