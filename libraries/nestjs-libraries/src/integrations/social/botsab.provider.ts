import {
  AuthTokenDetails,
  MediaContent,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import dayjs from 'dayjs';
import { Integration } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

type BotsabCredentials = {
  url: string;
  apiKey: string;
  instanceId: string;
};

// A Botsab "list" (either a saved group list or a saved contact list) is
// picked once at connect time and becomes the channel itself - encoded as
// `group:<id>` / `contact:<id>` in the integration's internalId - rather
// than being re-picked on every post.
type BotsabListRef = { kind: 'group' | 'contact'; listId: string };

const parseListRef = (page: string): BotsabListRef => {
  const [kind, listId] = page.split(':');
  return { kind: kind as 'group' | 'contact', listId };
};

export class BotsabProvider extends SocialAbstract implements SocialProvider {
  identifier = 'botsab';
  name = 'Botsab';
  isBetweenSteps = true;
  scopes = [] as string[];
  editor = 'normal' as const;

  maxLength() {
    return 4096;
  }

  private credentials(integration: Integration): BotsabCredentials {
    return JSON.parse(
      AuthService.fixedDecryption(integration.customInstanceDetails!)
    );
  }

  // pages()/fetchPageInformation()/reConnect() only ever receive `accessToken`
  // (no integration row exists yet the first time pages() runs), so unlike
  // Facebook et al. accessToken here is the same base64 credentials blob the
  // connect form submitted, not a bare bearer token.
  private decode(accessToken: string): BotsabCredentials {
    return JSON.parse(Buffer.from(accessToken, 'base64').toString());
  }

  private async request(
    body: BotsabCredentials,
    path: string,
    options: RequestInit = {}
  ) {
    const url = body.url.replace(/\/$/, '');
    return (
      await this.fetch(`${url}${path}`, {
        ...options,
        headers: {
          'x-api-key': body.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
    ).json();
  }

  private async groupLists(body: BotsabCredentials) {
    const lists = await this.request(body, '/group-lists');
    return lists.map((list: any) => ({ id: list.id, name: list.name }));
  }

  private async contactLists(body: BotsabCredentials) {
    const lists = await this.request(body, '/contact-lists');
    return lists.map((list: any) => ({ id: list.id, name: list.name }));
  }

  async customFields() {
    return [
      {
        key: 'url',
        label: 'Botsab URL',
        defaultValue: 'https://botsab.shackyapps.in',
        validation: `/^(https?:\\/\\/)(?:\\S+(?::\\S*)?@)?(?:(?:localhost)|(?:\\d{1,3}(?:\\.\\d{1,3}){3})|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63})(?::\\d{2,5})?(?:\\/[^\\s?#]*)?$/`,
        type: 'text' as const,
      },
      {
        key: 'instanceId',
        label: 'Instance ID',
        validation: `/^.+$/`,
        type: 'text' as const,
        hint: 'The instance id from your Botsab dashboard - it must already be paired with WhatsApp there',
      },
      {
        key: 'apiKey',
        label: 'API Key',
        validation: `/^.+$/`,
        type: 'password' as const,
      },
    ];
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  async generateAuthUrl() {
    const state = makeId(6);
    return {
      url: state,
      codeVerifier: makeId(10),
      state,
    };
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }) {
    const body: BotsabCredentials = JSON.parse(
      Buffer.from(params.code, 'base64').toString()
    );

    try {
      const instances = await this.request(body, '/instances');
      const instance = instances.find(
        (current: any) => current.id === body.instanceId
      );

      if (!instance) {
        return 'Instance not found for this API key';
      }

      if (instance.status !== 'connected') {
        return 'This instance is not connected yet - pair it with WhatsApp in Botsab first';
      }

      return {
        id: instance.id,
        name: instance.phoneNumber || instance.slug,
        // Self-sufficient for pages()/fetchPageInformation(), which only get
        // this accessToken back, never the integration row.
        accessToken: params.code,
        refreshToken: '',
        expiresIn: dayjs().add(100, 'years').unix() - dayjs().unix(),
        picture: '',
        username: instance.phoneNumber || instance.slug,
      };
    } catch (e) {
      console.log(e);
      return 'Could not connect to Botsab with the given URL and API key';
    }
  }

  // Called once right after authenticate() succeeds, to offer the "pick a
  // page" step every isBetweenSteps provider goes through - here the choices
  // are Botsab's own saved group/contact lists, combined into one list.
  async pages(accessToken: string) {
    const body = this.decode(accessToken);
    const [groups, contacts] = await Promise.all([
      this.groupLists(body),
      this.contactLists(body),
    ]);

    return [
      ...groups.map((list: any) => ({
        id: `group:${list.id}`,
        name: `${list.name} (Group List)`,
      })),
      ...contacts.map((list: any) => ({
        id: `contact:${list.id}`,
        name: `${list.name} (Contact List)`,
      })),
    ];
  }

  async fetchPageInformation(accessToken: string, data: { page: string }) {
    const body = this.decode(accessToken);
    const { kind, listId } = parseListRef(data.page);
    const lists =
      kind === 'group'
        ? await this.groupLists(body)
        : await this.contactLists(body);
    const list = lists.find((l: any) => l.id === listId);

    return {
      id: data.page,
      name: `${body.instanceId} - ${list?.name || listId}`,
      access_token: accessToken,
      picture: '',
      username: data.page,
    };
  }

  async reConnect(id: string, requiredId: string, accessToken: string) {
    const information = await this.fetchPageInformation(accessToken, {
      page: requiredId,
    });

    return {
      id: information.id,
      name: information.name,
      accessToken: information.access_token,
      picture: information.picture,
      username: information.username,
    };
  }

  // Botsab's campaign endpoint caps image/video captions at 1024 chars (its
  // direct single-send endpoint and this provider's own maxLength() of 4096
  // don't), so a longer caption has to be trimmed here or campaign creation
  // is rejected outright for posts that used to go through fine.
  private messageBody(media: MediaContent | undefined, message: string) {
    if (!media) {
      return { type: 'text' as const, text: message };
    }

    const caption = message.slice(0, 1024);
    if (media.type === 'video') {
      return { type: 'video' as const, url: media.path, caption };
    }

    return { type: 'image' as const, url: media.path, caption };
  }

  // Delivery pacing for group posts, handed to Botsab's own campaign runner
  // instead of this provider sending message-by-message. Botsab's built-in
  // group defaults (3-8 min between groups, 8/day cap) are tuned for a
  // standalone bulk-messaging tool run over days; a post scheduled from
  // SocioBird's calendar needs to actually finish within a few hours, so
  // this keeps the same shuffled/batched/randomized-delay shape but on a
  // faster clock. maxRecipients/dailyLimit are raised to Botsab's own hard
  // cap (200) purely so a list anywhere near its max size (100 groups)
  // isn't silently truncated or stalled waiting for the next calendar day.
  private readonly GROUP_CAMPAIGN_OPTIONS = {
    minDelayMs: 60_000,
    maxDelayMs: 180_000,
    batchSize: 5,
    batchPauseMs: 600_000,
    shuffle: true,
    appendSuffix: true,
    suffixType: 'invisible' as const,
    suffixLength: 4,
    sendTypingIndicator: true,
    markReadBeforeSend: true,
    maxRecipients: 200,
    sendStartHour: 7,
    sendEndHour: 23,
    dailyLimit: 200,
    checkNumberExists: false,
    respectOptOut: true,
  };

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const [firstPost] = postDetails;
    const body = this.credentials(integration);
    const messageBody = this.messageBody(
      firstPost.media?.[0],
      firstPost.message
    );
    const { kind, listId } = parseListRef(integration.internalId);

    // Hand off to Botsab's own campaign runner instead of sending to every
    // group/contact from here - it owns the anti-ban pacing (randomized
    // delays, batching, shuffling, image-hash variation) and runs it in the
    // background, so this call returns as soon as Botsab accepts the
    // campaign rather than blocking for the hours the send itself takes.
    const campaign = await this.request(
      body,
      `/instances/${body.instanceId}/campaigns`,
      {
        method: 'POST',
        body: JSON.stringify({
          list_type: kind,
          list_id: listId,
          message: messageBody,
          ...(kind === 'group' ? { options: this.GROUP_CAMPAIGN_OPTIONS } : {}),
        }),
      }
    );

    return [
      {
        id: firstPost.id,
        postId: campaign.id,
        releaseURL: '',
        status: 'completed',
      },
    ];
  }
}
