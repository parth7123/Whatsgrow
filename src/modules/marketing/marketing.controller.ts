import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  Delete,
  Put,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { MarketingService } from './marketing.service';
import { CurrentUser, RequireRole, Public } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { User, UserRole } from '../users/entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Marketing')
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Post('upload-media')
  @RequireRole(ApiKeyRole.OPERATOR)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload media for a campaign' })
  uploadMedia(@UploadedFile() file: { buffer?: Buffer; originalname?: string; mimetype?: string }) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    // Save the file to data/uploads/marketing/
    const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'marketing');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Create a unique filename
    const ext = path.extname(file.originalname || '');
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, file.buffer);

    return {
      success: true,
      mediaUrl: filePath,
      mediaType: file.mimetype,
    };
  }

  @Get('media/preview')
  @Public()
  @ApiOperation({ summary: 'Preview uploaded marketing media' })
  async previewMediaFile(@Query('path') mediaPath: string, @Res() res: any) {
    if (!mediaPath) {
      throw new BadRequestException('Media path is required');
    }
    const uploadDir = path.resolve(process.cwd(), 'data', 'uploads', 'marketing');
    let resolvedPath = path.resolve(mediaPath);

    if (!resolvedPath.startsWith(uploadDir)) {
      resolvedPath = path.resolve(uploadDir, path.basename(mediaPath));
    }

    if (!resolvedPath.startsWith(uploadDir) || !fs.existsSync(resolvedPath)) {
      throw new NotFoundException('Media file not found');
    }

    return res.sendFile(resolvedPath);
  }

  @Get('contacts')
  getContacts(@Query('all') all?: string, @CurrentUser() user?: User) {
    const targetUserId = (all === 'true' && user?.role === UserRole.ADMIN) ? undefined : user?.id;
    return this.marketingService.getContacts(targetUserId);
  }

  @Post('contacts')
  @RequireRole(ApiKeyRole.OPERATOR)
  createContact(@Body() data: any, @CurrentUser() user?: User) {
    return this.marketingService.createContact(data, user?.id);
  }

  @Post('contacts/bulk')
  @RequireRole(ApiKeyRole.OPERATOR)
  createContactsBulk(@Body() data: any[], @CurrentUser() user?: User) {
    return this.marketingService.createContactsBulk(data, user?.id);
  }

  @Put('contacts/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  async updateContact(@Param('id') id: string, @Body() data: any, @CurrentUser() user?: User) {
    return this.marketingService.updateContact(id, data, user?.id);
  }

  @Delete('contacts/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  async deleteContact(@Param('id') id: string, @CurrentUser() user?: User) {
    await this.marketingService.deleteContact(id, user?.id);
    return { success: true };
  }

  @Post('contacts/bulk-delete')
  @RequireRole(ApiKeyRole.OPERATOR)
  async deleteContacts(@Body('ids') ids: string[], @CurrentUser() user?: User) {
    return this.marketingService.deleteContacts(ids, user?.id);
  }

  @Get('campaigns')
  getCampaigns(@Query('all') all?: string, @CurrentUser() user?: User) {
    const targetUserId = (all === 'true' && user?.role === UserRole.ADMIN) ? undefined : user?.id;
    return this.marketingService.getCampaigns(targetUserId);
  }

  @Post('campaigns')
  @RequireRole(ApiKeyRole.OPERATOR)
  createCampaign(@Body() data: any, @CurrentUser() user?: User) {
    return this.marketingService.createCampaign(data, user?.id);
  }

  @Put('campaigns/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  updateCampaign(@Param('id') id: string, @Body() data: any, @CurrentUser() user?: User) {
    return this.marketingService.updateCampaign(id, data, user?.id);
  }

  @Delete('campaigns/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  async deleteCampaign(@Param('id') id: string, @CurrentUser() user?: User) {
    await this.marketingService.deleteCampaign(id, user?.id);
    return { success: true };
  }

  @Post('campaigns/:id/pause')
  @RequireRole(ApiKeyRole.OPERATOR)
  async pauseCampaign(@Param('id') id: string, @CurrentUser() user?: User) {
    await this.marketingService.pauseCampaign(id, user?.id);
    return { success: true };
  }

  // ── High-Volume Anti-Ban Consent & Disclaimer Endpoints ──
  @Get('consent/status')
  async getConsentStatus(
    @Query('sessionId') sessionId?: string,
    @Query('targetCount') targetCount?: string,
    @CurrentUser() user?: User,
  ) {
    const count = targetCount ? parseInt(targetCount, 10) || 0 : 0;
    return this.marketingService.checkConsentStatus(sessionId, user?.id, count);
  }

  @Post('consent/agree')
  @RequireRole(ApiKeyRole.OPERATOR)
  async recordConsent(@Body() body: any, @CurrentUser() user?: User) {
    return this.marketingService.recordUserConsent({
      userId: user?.id,
      userName: user?.username || 'Operator',
      userEmail: user?.username || 'Operator',
      sessionId: body?.sessionId,
      ipAddress: body?.ipAddress,
    });
  }

  @Get('consent/list')
  async getConsentsList(@CurrentUser() user?: User) {
    return this.marketingService.getAllConsents();
  }

  @Post('campaigns/:id/start')
  @RequireRole(ApiKeyRole.OPERATOR)
  async startCampaign(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.marketingService.startCampaign(id, user?.id);
  }

  @Post('campaigns/:id/restart')
  @RequireRole(ApiKeyRole.OPERATOR)
  async restartCampaign(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.marketingService.restartCampaign(id, user?.id);
  }
}
