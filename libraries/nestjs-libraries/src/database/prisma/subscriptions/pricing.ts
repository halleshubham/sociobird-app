export interface PricingInnerInterface {
  current: string;
  label: string;
  month_price: number;
  year_price: number;
  channel?: number;
  posts_per_month: number;
  team_members: boolean;
  community_features: boolean;
  featured_by_gitroom: boolean;
  ai: boolean;
  import_from_channels: boolean;
  image_generator?: boolean;
  image_generation_count: number;
  generate_videos: number;
  public_api: boolean;
  webhooks: number;
  autoPost: boolean;
}
export interface PricingInterface {
  [key: string]: PricingInnerInterface;
}
// AI features (writing assistant, image and video generation) are off on every
// plan for now: they are not offered, so no plan promises them
export const pricing: PricingInterface = {
  // No plan chosen yet (and what an organization falls back to when a
  // subscription ends): the app asks to pick a plan
  FREE: {
    current: 'FREE',
    label: 'No plan',
    month_price: 0,
    year_price: 0,
    channel: 0,
    image_generation_count: 0,
    posts_per_month: 0,
    team_members: false,
    community_features: false,
    featured_by_gitroom: false,
    ai: false,
    import_from_channels: false,
    image_generator: false,
    public_api: false,
    webhooks: 0,
    autoPost: false,
    generate_videos: 0,
  },
  // The free plan: a manual-style subscription an organization starts itself
  FREEPLAN: {
    current: 'FREEPLAN',
    label: 'Free',
    month_price: 0,
    year_price: 0,
    channel: 2,
    image_generation_count: 0,
    posts_per_month: 1000000,
    team_members: false,
    community_features: false,
    featured_by_gitroom: false,
    ai: false,
    import_from_channels: false,
    image_generator: false,
    public_api: false,
    webhooks: 0,
    autoPost: false,
    generate_videos: 0,
  },
  STANDARD: {
    current: 'STANDARD',
    label: 'Solo',
    month_price: 5,
    year_price: 48,
    channel: 5,
    posts_per_month: 1000000,
    image_generation_count: 0,
    team_members: false,
    ai: false,
    community_features: false,
    featured_by_gitroom: false,
    import_from_channels: true,
    image_generator: false,
    public_api: true,
    webhooks: 2,
    autoPost: false,
    generate_videos: 0,
  },
  TEAM: {
    current: 'TEAM',
    label: 'Team',
    month_price: 11,
    year_price: 106,
    channel: 15,
    posts_per_month: 1000000,
    image_generation_count: 0,
    community_features: true,
    team_members: true,
    featured_by_gitroom: true,
    ai: false,
    import_from_channels: true,
    image_generator: false,
    public_api: true,
    webhooks: 10,
    autoPost: true,
    generate_videos: 0,
  },
  PRO: {
    current: 'PRO',
    label: 'Agency',
    month_price: 21,
    year_price: 202,
    channel: 40,
    posts_per_month: 1000000,
    image_generation_count: 0,
    community_features: true,
    team_members: true,
    featured_by_gitroom: true,
    ai: false,
    import_from_channels: true,
    image_generator: false,
    public_api: true,
    webhooks: 30,
    autoPost: true,
    generate_videos: 0,
  },
  // Custom pricing: no self-serve price in any currency, handled by contact
  ULTIMATE: {
    current: 'ULTIMATE',
    label: 'Scale',
    month_price: 149,
    year_price: 1429,
    channel: 100,
    posts_per_month: 1000000,
    image_generation_count: 0,
    community_features: true,
    team_members: true,
    featured_by_gitroom: true,
    ai: false,
    import_from_channels: true,
    image_generator: false,
    public_api: true,
    webhooks: 10000,
    autoPost: true,
    generate_videos: 0,
  },
};
