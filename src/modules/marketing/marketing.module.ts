import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingService } from './marketing.service';
import { MarketingController } from './marketing.controller';
import { MarketingContact } from './entities/marketing-contact.entity';
import { Campaign } from './entities/campaign.entity';
import { UserConsent } from './entities/user-consent.entity';
import { MessageModule } from '../message/message.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [TypeOrmModule.forFeature([MarketingContact, Campaign, UserConsent], 'data'), MessageModule, SessionModule],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
