import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignMediaUrls1782760000000 implements MigrationInterface {
  name = 'AddCampaignMediaUrls1782760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "campaigns" ADD "mediaUrls" text`);
    await queryRunner.query(`ALTER TABLE "campaigns" ADD "mediaTypes" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "mediaUrls"`);
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "mediaTypes"`);
  }
}
