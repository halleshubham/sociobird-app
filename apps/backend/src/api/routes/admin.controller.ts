import {
  Body,
  Controller,
  Get,
  HttpException,
  Put,
  Query,
} from '@nestjs/common';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { Organization, User } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { StripLinksDto } from '@gitroom/nestjs-libraries/dtos/admin/strip.links.dto';
import { MeteredPostsDto } from '@gitroom/nestjs-libraries/dtos/admin/metered.posts.dto';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { ApiTags } from '@nestjs/swagger';
import { ErrorsService } from '@gitroom/nestjs-libraries/database/prisma/errors/errors.service';
import { AdminStatsService } from '@gitroom/nestjs-libraries/database/prisma/admin-stats/admin-stats.service';
import dayjs from 'dayjs';

@ApiTags('Admin')
@Controller('/admin')
export class AdminController {
  constructor(
    private _errorsService: ErrorsService,
    private _adminStatsService: AdminStatsService,
    private _organizationService: OrganizationService,
    private _integrationManager: IntegrationManager,
    private _postsService: PostsService
  ) {}

  private assertSuperAdmin(user: User) {
    if (!user?.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }
  }

  @Get('/errors')
  async listErrors(
    @GetUserFromRequest() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('platform') platform?: string,
    @Query('email') email?: string,
    @Query('unknownFirst') unknownFirst?: string
  ) {
    this.assertSuperAdmin(user);
    return this._errorsService.listErrors({
      page: page ? parseInt(page, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 20,
      platform: platform || undefined,
      email: email || undefined,
      unknownFirst: unknownFirst === 'true' || unknownFirst === '1',
    });
  }

  @Get('/errors/platforms')
  async listPlatforms(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._errorsService.listPlatforms();
  }

  @Get('/stats')
  async getStats(
    @GetUserFromRequest() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('unknownOnly') unknownOnly?: string
  ) {
    this.assertSuperAdmin(user);

    const fromDate = from ? dayjs(from) : dayjs().subtract(30, 'day');
    const toDate = to ? dayjs(to) : dayjs();

    return this._adminStatsService.getStats({
      from: fromDate.startOf('day').toDate(),
      to: toDate.endOf('day').toDate(),
      unknownOnly: unknownOnly === 'true' || unknownOnly === '1',
    });
  }

  // Options of the organization the superadmin is currently viewing
  @Get('/org-settings')
  async getOrgSettings(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    this.assertSuperAdmin(user);
    const current = await this._organizationService.getOrgById(org.id);

    const providers = this._integrationManager.getAllowedSocialsIntegrations();

    // until a superadmin saves a choice, the providers' own defaults apply
    return {
      stripLinksProviders: current?.stripLinksConfigured
        ? current.stripLinksProviders
        : providers.filter((provider) =>
            this._integrationManager
              .getSocialIntegration(provider)
              ?.stripLinksByDefault?.()
          ),
      providers,
      metered: await this._postsService.meteredUsage(org.id),
    };
  }

  @Put('/org-settings/metered-posts')
  async setMeteredPosts(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: MeteredPostsDto
  ) {
    this.assertSuperAdmin(user);
    await this._organizationService.setMeteredPostsOverride(org.id, body.limit);
    return this._postsService.meteredUsage(org.id);
  }

  @Put('/org-settings/strip-links')
  async setStripLinks(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: StripLinksDto
  ) {
    this.assertSuperAdmin(user);
    const allowed = this._integrationManager.getAllowedSocialsIntegrations();
    if (body.providers.some((provider) => !allowed.includes(provider))) {
      throw new HttpException('Unknown provider', 400);
    }

    return this._organizationService.setStripLinksProviders(
      org.id,
      body.providers
    );
  }
}
