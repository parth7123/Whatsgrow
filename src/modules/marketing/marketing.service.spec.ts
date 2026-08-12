import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MarketingService } from './marketing.service';
import { MarketingContact } from './entities/marketing-contact.entity';
import { Campaign } from './entities/campaign.entity';
import { UserConsent } from './entities/user-consent.entity';
import { MessageService } from '../message/message.service';
import { SessionService } from '../session/session.service';

describe('MarketingService', () => {
  let service: MarketingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingService,
        { provide: getRepositoryToken(MarketingContact, 'data'), useValue: {} },
        { provide: getRepositoryToken(Campaign, 'data'), useValue: {} },
        { provide: getRepositoryToken(UserConsent, 'data'), useValue: {} },
        { provide: MessageService, useValue: {} },
        { provide: SessionService, useValue: {} },
      ],
    }).compile();

    service = module.get<MarketingService>(MarketingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Contact Deduplication & Tag Merging', () => {
    let mockContactsRepo: any;

    beforeEach(() => {
      mockContactsRepo = {
        find: jest.fn(),
        create: jest.fn(data => data),
        save: jest.fn(data => Promise.resolve(data)),
        update: jest.fn(),
        delete: jest.fn(),
        findOne: jest.fn(),
      };
      (service as any).contactsRepository = mockContactsRepo;
    });

    it('should merge tags when createContact is called with an existing phone number', async () => {
      const existingContact = {
        id: '1',
        name: 'John',
        phone: '+911111111111',
        tags: ['vip'],
        userId: 'user-1',
        createdAt: new Date(),
      };
      mockContactsRepo.find.mockResolvedValue([existingContact]);

      const result = await service.createContact(
        {
          name: 'John Doe',
          phone: '+911111111111',
          tags: ['lead'],
        },
        'user-1',
      );

      expect(result.tags).toEqual(['vip', 'lead']);
      expect(result.name).toBe('John');
      expect(mockContactsRepo.save).toHaveBeenCalledWith(existingContact);
      expect(mockContactsRepo.create).not.toHaveBeenCalled();
    });

    it('should merge tags across duplicates in createContactsBulk', async () => {
      mockContactsRepo.find.mockResolvedValue([]);

      const batch = [
        { name: 'Alice', phone: '+911111111111', tags: ['vip'] },
        { name: 'Alice', phone: '+911111111111', tags: ['lead'] },
      ];

      const result = await service.createContactsBulk(batch, 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(['vip', 'lead']);
    });

    it('should automatically deduplicate existing DB rows when getContacts is called', async () => {
      const contact1 = {
        id: '1',
        name: 'Bob',
        phone: '+912222222222',
        tags: ['vip'],
        createdAt: new Date('2026-01-01'),
      };
      const contact2 = {
        id: '2',
        name: 'Bob Updated',
        phone: '+912222222222',
        tags: ['lead'],
        createdAt: new Date('2026-01-02'),
      };
      mockContactsRepo.find.mockResolvedValue([contact1, contact2]);

      const result = await service.getContacts('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(['vip', 'lead']);
      expect(mockContactsRepo.delete).toHaveBeenCalledWith(['2']);
    });
  });

  describe('updateCampaign', () => {
    let mockCampaignsRepo: any;

    beforeEach(() => {
      mockCampaignsRepo = {
        findOne: jest.fn(),
        save: jest.fn(data => Promise.resolve(data)),
      };
      (service as any).campaignsRepository = mockCampaignsRepo;
    });

    it('should update draft campaign details successfully', async () => {
      const existingCampaign = {
        id: 'camp-1',
        name: 'Old Promo',
        status: 'draft',
        audience: 'vip',
      };
      mockCampaignsRepo.findOne.mockResolvedValue(existingCampaign);

      const result = await service.updateCampaign('camp-1', { name: 'New Promo', audience: 'vip,lead' });

      expect(result.name).toBe('New Promo');
      expect(result.audience).toBe('vip,lead');
      expect(mockCampaignsRepo.save).toHaveBeenCalledWith(existingCampaign);
    });

    it('should throw error if trying to update a running campaign', async () => {
      mockCampaignsRepo.findOne.mockResolvedValue({
        id: 'camp-2',
        status: 'running',
      });

      await expect(service.updateCampaign('camp-2', { name: 'New Promo' })).rejects.toThrow(
        'Cannot edit a running campaign. Please pause it first.'
      );
    });
  });
});
