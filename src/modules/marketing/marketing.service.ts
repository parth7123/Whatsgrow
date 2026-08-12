import { Injectable, Logger, OnApplicationBootstrap, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, In, MoreThanOrEqual } from 'typeorm';
import { MarketingContact } from './entities/marketing-contact.entity';
import { Campaign } from './entities/campaign.entity';
import { UserConsent } from './entities/user-consent.entity';
import { MessageService } from '../message/message.service';
import { SessionService } from '../session/session.service';
import { isFatalCdpError } from '../../engine/adapters/whatsapp-web-js.adapter';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MarketingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    @InjectRepository(MarketingContact, 'data')
    private contactsRepository: Repository<MarketingContact>,
    @InjectRepository(Campaign, 'data')
    private campaignsRepository: Repository<Campaign>,
    @InjectRepository(UserConsent, 'data')
    private userConsentsRepository: Repository<UserConsent>,
    private messageService: MessageService,
    private sessionService: SessionService,
  ) {}

  async onApplicationBootstrap() {
    try {
      const res = await this.campaignsRepository.update({ status: 'running' }, { status: 'paused' });
      if (res.affected && res.affected > 0) {
        this.logger.log(`Reset ${res.affected} running campaigns to paused on startup`);
      }
    } catch (err) {
      this.logger.error('Failed to reset running campaigns on startup', err);
    }
  }

  private mergeTags(...tagArrays: (string[] | undefined)[]): string[] {
    const tagMap = new Map<string, string>();
    tagArrays.forEach(arr => {
      if (Array.isArray(arr)) {
        arr.forEach(t => {
          if (t && typeof t === 'string' && t.trim()) {
            const trimmed = t.trim();
            tagMap.set(trimmed.toLowerCase(), trimmed);
          }
        });
      }
    });
    return Array.from(tagMap.values());
  }

  private async findContactsByAudience(audience: string, userId?: string): Promise<MarketingContact[]> {
    const allContacts = await this.getContacts(userId);
    const target = (audience || '').trim().toLowerCase();
    if (!target || target === 'general' || target === 'all') {
      return allContacts;
    }
    const targetList = target.split(',').map(s => s.trim()).filter(Boolean);

    return allContacts.filter(contact => {
      if (!contact.tags || !Array.isArray(contact.tags) || contact.tags.length === 0) return false;
      return contact.tags.some(tag => {
        if (!tag || typeof tag !== 'string') return false;
        const cleanTag = tag.trim().toLowerCase();
        return targetList.some(t => cleanTag === t || cleanTag.includes(t) || t.includes(cleanTag));
      });
    });
  }

  async getContacts(userId?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    const contacts = await this.contactsRepository.find({ where, order: { createdAt: 'DESC' } });

    const phoneMap = new Map<string, MarketingContact>();
    const duplicatesToDelete: string[] = [];
    let hasChanges = false;

    for (const c of contacts) {
      const cleanPhone = (c.phone || '').replace(/\D/g, '') || (c.phone || '').trim();
      if (!cleanPhone) continue;

      if (!c.tags || !Array.isArray(c.tags) || c.tags.length === 0 || !c.tags.some(t => t && typeof t === 'string' && t.trim())) {
        c.tags = ['general'];
        hasChanges = true;
      }

      if (phoneMap.has(cleanPhone)) {
        const primary = phoneMap.get(cleanPhone)!;
        const mergedTags = this.mergeTags(primary.tags, c.tags);
        if (mergedTags.length !== (primary.tags || []).length || !mergedTags.every(t => (primary.tags || []).includes(t))) {
          primary.tags = mergedTags;
          hasChanges = true;
        }
        if (!primary.name && c.name) {
          primary.name = c.name;
          hasChanges = true;
        }
        duplicatesToDelete.push(c.id);
      } else {
        const cleanTags = this.mergeTags(c.tags);
        if (cleanTags.length !== (c.tags || []).length) {
          c.tags = cleanTags;
          hasChanges = true;
        }
        phoneMap.set(cleanPhone, c);
      }
    }

    if (duplicatesToDelete.length > 0) {
      await this.contactsRepository.delete(duplicatesToDelete);
    }
    if (hasChanges) {
      await this.contactsRepository.save(Array.from(phoneMap.values()));
    }

    return Array.from(phoneMap.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createContact(data: Partial<MarketingContact>, userId?: string) {
    const rawPhone = (data.phone || '').trim();
    const cleanPhone = rawPhone.replace(/\D/g, '') || rawPhone;
    const incomingTags = this.mergeTags(data.tags);

    const existingContacts = await this.getContacts(userId);
    const existing = existingContacts.find(c => {
      const cPhone = (c.phone || '').replace(/\D/g, '') || (c.phone || '').trim();
      return cPhone === cleanPhone;
    });

    if (existing) {
      existing.tags = this.mergeTags(existing.tags, incomingTags);
      if (existing.tags.length === 0) {
        throw new BadRequestException('Contact must have at least one tag.');
      }
      if (data.name && data.name !== existing.name && !existing.name) {
        existing.name = data.name;
      }
      return this.contactsRepository.save(existing);
    }

    if (incomingTags.length === 0) {
      throw new BadRequestException('Contact must have at least one tag.');
    }

    const contact = this.contactsRepository.create({
      ...data,
      tags: incomingTags,
      userId: userId || null,
    });
    return this.contactsRepository.save(contact);
  }

  async createContactsBulk(data: Partial<MarketingContact>[], userId?: string) {
    const existingContacts = await this.getContacts(userId);
    const phoneMap = new Map<string, MarketingContact>();

    existingContacts.forEach(c => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '') || (c.phone || '').trim();
      if (cleanPhone) {
        phoneMap.set(cleanPhone, c);
      }
    });

    const contactsToSaveMap = new Map<string, MarketingContact>();

    for (const item of data) {
      const rawPhone = (item.phone || '').trim();
      if (!rawPhone) continue;
      const cleanPhone = rawPhone.replace(/\D/g, '') || rawPhone;
      const incomingTags = this.mergeTags(item.tags);

      if (phoneMap.has(cleanPhone)) {
        const existing = phoneMap.get(cleanPhone)!;
        existing.tags = this.mergeTags(existing.tags, incomingTags);
        if (item.name && item.name !== existing.name && !existing.name) {
          existing.name = item.name;
        }
        contactsToSaveMap.set(cleanPhone, existing);
      } else if (contactsToSaveMap.has(cleanPhone)) {
        const existingNew = contactsToSaveMap.get(cleanPhone)!;
        existingNew.tags = this.mergeTags(existingNew.tags, incomingTags);
        if (item.name && item.name !== existingNew.name && !existingNew.name) {
          existingNew.name = item.name;
        }
      } else {
        if (incomingTags.length === 0) {
          throw new BadRequestException(`Contact "${item.phone || item.name}" must have at least one tag.`);
        }
        const newContact = this.contactsRepository.create({
          ...item,
          tags: incomingTags,
          userId: userId || null,
        });
        contactsToSaveMap.set(cleanPhone, newContact);
        phoneMap.set(cleanPhone, newContact);
      }
    }

    const toSave = Array.from(contactsToSaveMap.values());
    if (toSave.length > 0) {
      await this.contactsRepository.save(toSave);
    }
    return toSave;
  }

  async updateContact(id: string, data: Partial<MarketingContact>, userId?: string) {
    const where: any = { id };
    if (userId) where.userId = userId;

    if (data.tags !== undefined) {
      data.tags = this.mergeTags(data.tags);
      if (data.tags.length === 0) {
        throw new BadRequestException('Contact must have at least one tag.');
      }
    }

    const existing = await this.contactsRepository.findOne({ where });
    if (!existing) return null;

    if (data.phone) {
      const targetPhone = data.phone.trim();
      const cleanTargetPhone = targetPhone.replace(/\D/g, '') || targetPhone;

      const allContacts = await this.getContacts(userId);
      const duplicate = allContacts.find(c => {
        if (c.id === id) return false;
        const cPhone = (c.phone || '').replace(/\D/g, '') || (c.phone || '').trim();
        return cPhone === cleanTargetPhone;
      });

      if (duplicate) {
        existing.tags = this.mergeTags(existing.tags, duplicate.tags, data.tags);
        if (data.name) existing.name = data.name;
        existing.phone = data.phone;

        await this.contactsRepository.delete(duplicate.id);
        return this.contactsRepository.save(existing);
      }
    }

    await this.contactsRepository.update(where, data);
    return this.contactsRepository.findOne({ where });
  }

  async deleteContact(id: string, userId?: string) {
    const where: any = { id };
    if (userId) where.userId = userId;
    return this.contactsRepository.delete(where);
  }

  async deleteContacts(ids: string[], userId?: string) {
    if (!ids || ids.length === 0) return { success: true, affected: 0 };
    const where: any = { id: In(ids) };
    if (userId) where.userId = userId;
    const result = await this.contactsRepository.delete(where);
    return { success: true, affected: result.affected || 0 };
  }

  // ── High-Volume Anti-Ban Consent & Daily Limits ──
  async getDailyMessageCount(sessionId?: string, userId?: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const where: any = {
      createdAt: MoreThanOrEqual(startOfDay),
    };
    if (sessionId) where.sessionId = sessionId;
    if (userId) where.userId = userId;

    const campaigns = await this.campaignsRepository.find({ where });
    const totalSentToday = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
    return totalSentToday;
  }

  async checkConsentStatus(sessionId?: string, userId?: string, targetCount: number = 0) {
    const dailyCount = await this.getDailyMessageCount(sessionId, userId);
    const projectedTotal = dailyCount + targetCount;
    const isOverThreshold = projectedTotal > 500;

    const consentWhere: any = { consentType: 'HIGH_VOLUME_BAN_RESPONSIBILITY', acknowledgedRisk: true };
    if (userId) consentWhere.userId = userId;
    if (sessionId) consentWhere.sessionId = sessionId;

    let consent = await this.userConsentsRepository.findOne({ where: consentWhere, order: { createdAt: 'DESC' } });
    if (!consent && userId) {
      consent = await this.userConsentsRepository.findOne({ where: { userId, consentType: 'HIGH_VOLUME_BAN_RESPONSIBILITY', acknowledgedRisk: true }, order: { createdAt: 'DESC' } });
    }

    const hasConsented = Boolean(consent);

    return {
      dailyCount,
      projectedTotal,
      threshold: 500,
      isOverThreshold,
      hasConsented,
      requiresConsent: isOverThreshold && !hasConsented,
      consent,
    };
  }

  async recordUserConsent(data: {
    userId?: string;
    userName?: string;
    userEmail?: string;
    sessionId?: string;
    ipAddress?: string;
  }) {
    const consent = this.userConsentsRepository.create({
      userId: data.userId || null,
      userName: data.userName || null,
      userEmail: data.userEmail || null,
      sessionId: data.sessionId || null,
      ipAddress: data.ipAddress || null,
      consentType: 'HIGH_VOLUME_BAN_RESPONSIBILITY',
      acknowledgedRisk: true,
      dailyThreshold: 500,
    });
    return this.userConsentsRepository.save(consent);
  }

  async getAllConsents() {
    return this.userConsentsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async getCampaigns(userId?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    const campaigns = await this.campaignsRepository.find({ where, order: { createdAt: 'DESC' } });
    let updated = false;
    for (const c of campaigns) {
      if (c.status === 'completed' && c.sentCount === 0 && c.totalCount > 0) {
        c.status = 'failed';
        updated = true;
      }
      const expectedTotal = Math.max(c.totalSentCount || 0, c.sentCount || 0);
      if (c.totalSentCount !== expectedTotal) {
        c.totalSentCount = expectedTotal;
        updated = true;
      }
    }
    if (updated) {
      await this.campaignsRepository.save(campaigns);
    }
    return campaigns;
  }

  async createCampaign(data: Partial<Campaign>, userId?: string) {
    const campaign = this.campaignsRepository.create({
      ...data,
      userId: userId || null,
    });
    return this.campaignsRepository.save(campaign);
  }

  async updateCampaign(id: string, data: Partial<Campaign>, userId?: string) {
    const where: any = { id };
    if (userId) where.userId = userId;
    const campaign = await this.campaignsRepository.findOne({ where });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (campaign.status === 'running') {
      throw new BadRequestException('Cannot edit a running campaign. Please pause it first.');
    }

    if (data.name !== undefined) campaign.name = data.name;
    if (data.audience !== undefined) campaign.audience = data.audience;
    if (data.sessionId !== undefined) campaign.sessionId = data.sessionId;
    if (data.templateId !== undefined) campaign.templateId = data.templateId;
    if (data.messageText !== undefined) campaign.messageText = data.messageText;
    if (data.mediaUrl !== undefined) campaign.mediaUrl = data.mediaUrl;
    if (data.mediaType !== undefined) campaign.mediaType = data.mediaType;
    if (data.mediaUrls !== undefined) campaign.mediaUrls = data.mediaUrls;
    if (data.mediaTypes !== undefined) campaign.mediaTypes = data.mediaTypes;

    return this.campaignsRepository.save(campaign);
  }

  async deleteCampaign(id: string, userId?: string) {
    const where: any = { id };
    if (userId) where.userId = userId;
    return this.campaignsRepository.delete(where);
  }

  async startCampaign(id: string, userId?: string) {
    const whereCampaign: FindOptionsWhere<Campaign> = { id };
    if (userId) whereCampaign.userId = userId;
    const campaign = await this.campaignsRepository.findOne({ where: whereCampaign });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (!campaign.sessionId) throw new BadRequestException('Campaign has no session ID selected');
    if (!campaign.messageText && !campaign.templateId)
      throw new BadRequestException('Campaign must have either message text or a template selected');

    // Make sure they can use the session
    const session = await this.sessionService.findOne(campaign.sessionId, userId);
    if (!session || session.status !== 'ready') {
      throw new BadRequestException(`Session '${campaign.sessionId}' is not active. Please connect the session first.`);
    }

    // Find contacts matching the audience tag reliably using findContactsByAudience
    const contacts = await this.findContactsByAudience(campaign.audience, userId);

    if (contacts.length === 0) {
      const allContacts = await this.getContacts(userId);
      const availableTags = Array.from(new Set(allContacts.flatMap(c => c.tags || []))).filter(Boolean);
      const tagsInfo = availableTags.length > 0 ? `Your existing contacts have tags: [ ${availableTags.join(', ')} ]` : 'You currently have no contacts added.';
      throw new BadRequestException(`No contacts found matching audience tag "${campaign.audience}". ${tagsInfo}. Please edit the campaign audience tag or add contacts with this tag.`);
    }

    const isResume = campaign.status === 'paused' && campaign.sentCount > 0;
    const contactsToProcess = isResume ? contacts.slice(campaign.sentCount) : contacts;

    // Check High-Volume Anti-Ban Consent Status before launching
    const consentStatus = await this.checkConsentStatus(campaign.sessionId, userId, contactsToProcess.length);
    if (consentStatus.requiresConsent) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'CONSENT_REQUIRED',
        message: 'High-Volume Anti-Ban Consent Required. Sending over 500 daily messages requires accepting full responsibility for WhatsApp account ban risks.',
        dailyCount: consentStatus.dailyCount,
        projectedTotal: consentStatus.projectedTotal,
        threshold: 500,
      });
    }

    campaign.status = 'running';
    campaign.totalCount = contacts.length;
    if (!isResume) {
      campaign.sentCount = 0;
    }
    await this.campaignsRepository.save(campaign);

    // Fire and forget background process
    this.processCampaign(campaign, contactsToProcess).catch(err => {
      this.logger.error(`Error processing campaign ${campaign.id}:`, err);
    });

    return campaign;
  }

  async pauseCampaign(id: string, userId?: string) {
    const where: FindOptionsWhere<Campaign> = { id };
    if (userId) where.userId = userId;
    const campaign = await this.campaignsRepository.findOne({ where });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'running') throw new BadRequestException('Only running campaigns can be paused');
    campaign.status = 'paused';
    return this.campaignsRepository.save(campaign);
  }

  private async processCampaign(campaign: Campaign, contacts: MarketingContact[]) {
    // Pre-load and cache media items once before starting the contact loop.
    // This avoids re-reading files from disk & re-encoding base64 for every contact, making video sends 5x faster.
    const cachedMediaList: { url?: string; base64?: string; mimetype: string; filename: string }[] = [];

    if (campaign.mediaUrls && Array.isArray(campaign.mediaUrls) && campaign.mediaUrls.length > 0) {
      const types = campaign.mediaTypes || [];
      campaign.mediaUrls.forEach((fileUrl, idx) => {
        if (fileUrl && fs.existsSync(fileUrl)) {
          let mediaType = types[idx] || 'image/jpeg';
          if (mediaType === 'video/quicktime' || mediaType === 'video/avi' || mediaType === 'video/x-msvideo') {
            mediaType = 'video/mp4';
          }
          const base64 = fs.readFileSync(fileUrl).toString('base64');
          cachedMediaList.push({ base64, mimetype: mediaType, filename: path.basename(fileUrl) });
        } else if (fileUrl) {
          cachedMediaList.push({ url: fileUrl, mimetype: types[idx] || 'image/jpeg', filename: path.basename(fileUrl) });
        }
      });
    } else if (campaign.mediaUrl) {
      if (fs.existsSync(campaign.mediaUrl)) {
        let mediaType = campaign.mediaType || 'image/jpeg';
        if (mediaType === 'video/quicktime' || mediaType === 'video/avi' || mediaType === 'video/x-msvideo') {
          mediaType = 'video/mp4';
        }
        const base64 = fs.readFileSync(campaign.mediaUrl).toString('base64');
        cachedMediaList.push({ base64, mimetype: mediaType, filename: path.basename(campaign.mediaUrl) });
      } else {
        cachedMediaList.push({ url: campaign.mediaUrl, mimetype: campaign.mediaType || 'image/jpeg', filename: path.basename(campaign.mediaUrl) });
      }
    }

    for (const contact of contacts) {
      const current = await this.campaignsRepository.findOne({ where: { id: campaign.id } });
      if (!current || current.status !== 'running') {
        this.logger.log(`Campaign ${campaign.id} status changed to ${current?.status || 'deleted'}. Stopping send loop.`);
        return;
      }
      // Always use the freshly-loaded row so sentCount reflects what's actually in the DB
      campaign = current;

      try {
        // Construct valid WhatsApp JID (phone @c.us or @lid)
        let digits = contact.phone ? contact.phone.replace(/[^0-9]/g, '') : '';
        let chatId = '';

        if (contact.phone && (contact.phone.includes('@lid') || contact.phone.includes('@c.us'))) {
          chatId = contact.phone.trim();
        } else if (digits.length >= 10 && digits.length <= 14) {
          if (digits.length === 10 && /^[6-9]/.test(digits)) {
            digits = `91${digits}`;
          }
          chatId = `${digits}@c.us`;
        }

        // Validate chatId format (must be valid phone@c.us or id@lid)
        if (!chatId || chatId === '@c.us' || chatId === '@lid' || !/^\d+@(c\.us|lid)$/.test(chatId)) {
          this.logger.warn(`Skipping invalid or privacy-protected contact ${contact.name} (${contact.phone}) in campaign ${campaign.id}`);
          continue;
        }

        if (campaign.templateId) {
          // Map contact data into template variables
          const vars = {
            name: contact.name || '',
            phone: contact.phone || '',
          };

          let base64Data: string | undefined;
          let mediaType: string | undefined;
          let mediaUrlParam: string | undefined;

          if (cachedMediaList.length > 0) {
            const first = cachedMediaList[0];
            if (first.url) {
              mediaUrlParam = first.url;
            } else {
              base64Data = first.base64;
            }
            mediaType = first.mimetype;
          }

          await this.messageService.sendTemplate(campaign.sessionId, {
            chatId,
            templateId: campaign.templateId,
            vars,
            ...(mediaUrlParam ? { url: mediaUrlParam, mimetype: mediaType } : base64Data ? { base64: base64Data, mimetype: mediaType } : {}),
          });
        } else if (cachedMediaList.length > 0) {
          this.logger.log(`Campaign ${campaign.id}: sending ${cachedMediaList.length} media item(s) to ${contact.phone}`);
          for (let i = 0; i < cachedMediaList.length; i++) {
            const item = cachedMediaList[i];
            try {
              const payload = {
                chatId,
                caption: undefined,
                ...(item.url ? { url: item.url } : { base64: item.base64 }),
                mimetype: item.mimetype,
                filename: item.filename,
              };

              let sent = false;
              for (let attempt = 1; attempt <= 2 && !sent; attempt++) {
                try {
                  if (item.mimetype.startsWith('video/')) {
                    await this.messageService.sendVideo(campaign.sessionId, payload);
                  } else if (item.mimetype.startsWith('audio/')) {
                    await this.messageService.sendAudio(campaign.sessionId, payload);
                  } else if (item.mimetype.startsWith('image/')) {
                    await this.messageService.sendImage(campaign.sessionId, payload);
                  } else {
                    await this.messageService.sendDocument(campaign.sessionId, payload);
                  }
                  sent = true;
                } catch (sendErr) {
                  // Fatal CDP errors (detached frame etc.) must propagate out so the
                  // per-contact handler can pause the campaign immediately.
                  if (isFatalCdpError(sendErr)) throw sendErr;
                  if (attempt === 2) throw sendErr;
                  this.logger.warn(`Retrying media (${item.filename}) for ${contact.phone} after attempt ${attempt} failed: ${(sendErr as Error)?.message || sendErr}`);
                  await new Promise(r => setTimeout(r, 1500));
                }
              }

              await new Promise(r => setTimeout(r, 1_000));
            } catch (mediaErr) {
              if (isFatalCdpError(mediaErr)) throw mediaErr;
              this.logger.error(`Failed to send media item (${item.filename}) to ${contact.phone} in campaign ${campaign.id}:`, mediaErr);
            }
          }

          // Send text message AFTER all media files have finished sending
          if (campaign.messageText && campaign.messageText.trim()) {
            await this.messageService.sendText(campaign.sessionId, {
              chatId,
              text: campaign.messageText.trim(),
            });
          }
        } else {
          await this.messageService.sendText(campaign.sessionId, {
            chatId,
            text: campaign.messageText,
          });
        }

        campaign.sentCount++;
        campaign.totalSentCount = (campaign.totalSentCount || 0) + 1;
        await this.campaignsRepository.save(campaign);

        // Optimized gap between contacts
        await new Promise(r => setTimeout(r, 1_500));
      } catch (error) {
        const errMsg = (error instanceof Error ? error.message : String(error)) || '';
        this.logger.error(`Failed to send message to ${contact.phone} in campaign ${campaign.id}`);
        this.logger.error(`Error: ${errMsg}`);

        // A detached frame / target closed error means the WhatsApp Web page internally
        // refreshed. The engine usually self-heals within 15–60 seconds as it reconnects
        // its CDP session. Instead of pausing immediately, wait and check for recovery.
        if (isFatalCdpError(error)) {
          this.logger.warn(`Fatal CDP error for campaign ${campaign.id} — waiting up to 60s for session to self-heal before retrying contact ${contact.phone}...`);

          const healed = await this.waitForSessionReady(campaign.sessionId, 60_000);
          if (!healed) {
            // Session didn't recover — pause the campaign so the user can reconnect manually.
            this.logger.warn(`Session ${campaign.sessionId} did not recover in time — pausing campaign ${campaign.id}`);
            campaign.status = 'paused';
            await this.campaignsRepository.save(campaign);
            return; // Exit the send loop
          }

          // Session is back — retry this contact once (don't skip it)
          this.logger.log(`Session recovered — retrying contact ${contact.phone} in campaign ${campaign.id}`);
          try {
            let chatId = contact.phone.replace(/[^0-9]/g, '');
            if (!chatId.endsWith('@c.us')) chatId = `${chatId}@c.us`;
            await this.messageService.sendText(campaign.sessionId, { chatId, text: campaign.messageText || '' });
            campaign.sentCount++;
            campaign.totalSentCount = (campaign.totalSentCount || 0) + 1;
            await this.campaignsRepository.save(campaign);
          } catch (retryErr) {
            this.logger.error(`Retry after recovery also failed for ${contact.phone}: ${(retryErr as Error)?.message || retryErr}`);
          }
        }
      }
    }

    const finalCheck = await this.campaignsRepository.findOne({ where: { id: campaign.id } });
    if (finalCheck && finalCheck.status === 'running') {
      if (finalCheck.sentCount === 0 && finalCheck.totalCount > 0) {
        finalCheck.status = 'failed';
      } else {
        finalCheck.status = 'completed';
      }
      await this.campaignsRepository.save(finalCheck);
    }
  }

  /**
   * Wait for the WhatsApp engine to recover after a detached-frame / CDP error.
   *
   * Strategy:
   *  1. Wait a fixed minimum delay (15 s) — the engine needs time to detect the
   *     disconnection and start reconnecting before the DB status changes.
   *  2. Poll every 5 s until the session status is 'ready' again.
   *  3. Give up after `timeoutMs` total and return false.
   *
   * Returns true if the session recovers within the timeout, false otherwise.
   */
  private async waitForSessionReady(sessionId: string, timeoutMs: number): Promise<boolean> {
    const minWaitMs  = 15_000; // always wait at least 15 s before the first poll
    const pollInterval = 5_000;
    const deadline = Date.now() + timeoutMs;

    // Step 1: mandatory minimum wait so the engine has time to notice the failure.
    await new Promise(r => setTimeout(r, Math.min(minWaitMs, timeoutMs)));

    // Step 2: poll until ready or timeout.
    while (Date.now() < deadline) {
      try {
        const session = await this.sessionService.findOne(sessionId);
        if (session?.status === 'ready') return true;
      } catch {
        // Ignore transient DB errors during polling
      }
      await new Promise(r => setTimeout(r, pollInterval));
    }
    return false;
  }

  async restartCampaign(id: string, userId?: string) {
    const whereCampaign: FindOptionsWhere<Campaign> = { id };
    if (userId) whereCampaign.userId = userId;
    const campaign = await this.campaignsRepository.findOne({ where: whereCampaign });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const session = await this.sessionService.findOne(campaign.sessionId, userId);
    if (!session || session.status !== 'ready') {
      throw new BadRequestException(`Session '${campaign.sessionId}' is not active. Please connect the session first.`);
    }

    const contacts = await this.findContactsByAudience(campaign.audience, userId);

    if (contacts.length === 0) {
      const allContacts = await this.getContacts(userId);
      const availableTags = Array.from(new Set(allContacts.flatMap(c => c.tags || []))).filter(Boolean);
      const tagsInfo = availableTags.length > 0 ? `Your existing contacts have tags: [ ${availableTags.join(', ')} ]` : 'You currently have no contacts added.';
      throw new BadRequestException(`No contacts found matching audience tag "${campaign.audience}". ${tagsInfo}. Please edit the campaign audience tag or add contacts with this tag.`);
    }

    campaign.status = 'running';
    campaign.totalCount = contacts.length;
    campaign.totalSentCount = Math.max(campaign.totalSentCount || 0, campaign.sentCount || 0);
    campaign.sentCount = 0;
    await this.campaignsRepository.save(campaign);

    // Process asynchronously
    this.processCampaign(campaign, contacts).catch(err => {
      this.logger.error(`Error processing campaign ${campaign.id}:`, err);
    });
    return campaign;
  }
}
