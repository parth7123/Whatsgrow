import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignTotalSentCount1782770000000 implements MigrationInterface {
  name = 'AddCampaignTotalSentCount1782770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`ALTER TABLE "campaigns" ADD "totalSentCount" integer DEFAULT 0`);
    } catch {
      // Column may already exist
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "totalSentCount"`);
    } catch {
      // Ignore drop errors
    }
  }
}
