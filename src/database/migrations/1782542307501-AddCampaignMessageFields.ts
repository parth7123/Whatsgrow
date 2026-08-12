import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignMessageFields1782542307501 implements MigrationInterface {
  name = 'AddCampaignMessageFields1782542307501';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(`ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "messageText" text`);
      await queryRunner.query(`ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "sessionId" varchar`);
      return;
    }

    await queryRunner.query(
      `CREATE TABLE "temporary_campaigns" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "status" varchar NOT NULL DEFAULT ('draft'), "audience" varchar NOT NULL, "sentCount" integer NOT NULL DEFAULT (0), "totalCount" integer NOT NULL DEFAULT (0), "templateId" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "messageText" text, "sessionId" varchar)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_campaigns"("id", "name", "status", "audience", "sentCount", "totalCount", "templateId", "createdAt") SELECT "id", "name", "status", "audience", "sentCount", "totalCount", "templateId", "createdAt" FROM "campaigns"`,
    );
    await queryRunner.query(`DROP TABLE "campaigns"`);
    await queryRunner.query(`ALTER TABLE "temporary_campaigns" RENAME TO "campaigns"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "messageText"`);
      await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "sessionId"`);
      return;
    }

    await queryRunner.query(`ALTER TABLE "campaigns" RENAME TO "temporary_campaigns"`);
    await queryRunner.query(
      `CREATE TABLE "campaigns" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "status" varchar NOT NULL DEFAULT ('draft'), "audience" varchar NOT NULL, "sentCount" integer NOT NULL DEFAULT (0), "totalCount" integer NOT NULL DEFAULT (0), "templateId" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "campaigns"("id", "name", "status", "audience", "sentCount", "totalCount", "templateId", "createdAt") SELECT "id", "name", "status", "audience", "sentCount", "totalCount", "templateId", "createdAt" FROM "temporary_campaigns"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_campaigns"`);
  }
}
