import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { MarketingService } from './src/modules/marketing/marketing.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const svc = app.get(MarketingService);
  try {
    await svc.restartCampaign('a7d952ef-c883-4402-b2a3-8b2a8c1fe3d8');
    console.log('RESTARTED');
  } catch (e) {
    console.error('ERROR:', e);
  }
  // Wait a bit for processCampaign to finish
  await new Promise(r => setTimeout(r, 5000));
  await app.close();
}
bootstrap();
