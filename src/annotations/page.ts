import { BlockAnnotation } from "@atjson/document";

export default class Page extends BlockAnnotation {
  static vendorPrefix = "qtc";
  static type = "page";
  attributes!: {
    hasTickets: boolean;
    locale: string;
    group: {
      name: string;
      email: string;
    };
    post: {
      title: string;
      description: string;
      image?: string;
      url: string;
      section?: {
        id: string;
      };
    };
    sections: Array<{
      id: string;
      slug: string;
      name: string;
    }>;
  };

  get rank() {
    return 1;
  }
}
