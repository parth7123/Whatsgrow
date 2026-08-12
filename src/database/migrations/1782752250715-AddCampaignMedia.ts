import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignMedia1782752250715 implements MigrationInterface {
  name = 'AddCampaignMedia1782752250715';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "campaigns" ADD "mediaUrl" varchar`);
    await queryRunner.query(`ALTER TABLE "campaigns" ADD "mediaType" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite doesn't support DROP COLUMN natively in old versions, but modern SQLite and Postgres do.
    // For safety, we can just leave it as a no-op down migration for SQLite compatibility, or use DROP COLUMN.
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "mediaUrl"`);
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "mediaType"`);
  }
}
