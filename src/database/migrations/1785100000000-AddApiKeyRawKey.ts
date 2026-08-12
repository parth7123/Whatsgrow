import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiKeyRawKey1785100000000 implements MigrationInterface {
  name = 'AddApiKeyRawKey1785100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`ALTER TABLE "api_keys" ADD "key" varchar(255) NULL`);
    } catch {
      // Column may already exist
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "key"`);
    } catch {
      // Ignore drop errors
    }
  }
}
