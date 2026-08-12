import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarketingEntities1782541530769 implements MigrationInterface {
  name = 'AddMarketingEntities1782541530769';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "marketing_contacts" ("id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, "name" varchar NOT NULL, "phone" varchar NOT NULL, "tags" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now())`,
      );
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "campaigns" ("id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, "name" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'draft', "audience" varchar NOT NULL, "sentCount" integer NOT NULL DEFAULT 0, "totalCount" integer NOT NULL DEFAULT 0, "templateId" varchar, "createdAt" TIMESTAMP NOT NULL DEFAULT now())`,
      );
      return;
    }

    await queryRunner.query(`DROP INDEX "IDX_baileys_stored_messages_session_created"`);
    await queryRunner.query(`DROP INDEX "UQ_baileys_stored_messages_session_wamsg"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_baileys_stored_messages" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "waMessageId" varchar NOT NULL, "serializedMessage" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_baileys_stored_messages"("id", "sessionId", "waMessageId", "serializedMessage", "createdAt") SELECT "id", "sessionId", "waMessageId", "serializedMessage", "createdAt" FROM "baileys_stored_messages"`,
    );
    await queryRunner.query(`DROP TABLE "baileys_stored_messages"`);
    await queryRunner.query(`ALTER TABLE "temporary_baileys_stored_messages" RENAME TO "baileys_stored_messages"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_baileys_stored_messages_session_created" ON "baileys_stored_messages" ("sessionId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_baileys_stored_messages_session_wamsg" ON "baileys_stored_messages" ("sessionId", "waMessageId") `,
    );
    await queryRunner.query(`DROP INDEX "IDX_templates_session_name"`);
    await queryRunner.query(`DROP INDEX "IDX_templates_sessionId"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_templates" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "name" varchar(100) NOT NULL, "body" text NOT NULL, "header" text, "footer" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_templates"("id", "sessionId", "name", "body", "header", "footer", "createdAt", "updatedAt") SELECT "id", "sessionId", "name", "body", "header", "footer", "createdAt", "updatedAt" FROM "templates"`,
    );
    await queryRunner.query(`DROP TABLE "templates"`);
    await queryRunner.query(`ALTER TABLE "temporary_templates" RENAME TO "templates"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_templates_session_name" ON "templates" ("sessionId", "name") `);
    await queryRunner.query(`CREATE INDEX "IDX_templates_sessionId" ON "templates" ("sessionId") `);
    await queryRunner.query(`DROP INDEX "IDX_lid_mappings_phone"`);
    await queryRunner.query(`DROP INDEX "IDX_baileys_stored_messages_session_created"`);
    await queryRunner.query(`DROP INDEX "UQ_baileys_stored_messages_session_wamsg"`);
    await queryRunner.query(`DROP INDEX "IDX_templates_sessionId"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_webhooks" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "url" varchar(2048) NOT NULL, "events" text NOT NULL DEFAULT ('["message.received"]'), "secret" varchar(255), "headers" text NOT NULL DEFAULT ('{}'), "active" boolean NOT NULL DEFAULT (1), "retryCount" integer NOT NULL DEFAULT (3), "lastTriggeredAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "filters" text, CONSTRAINT "FK_d209715bb62b12255e825580af6" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_webhooks"("id", "sessionId", "url", "events", "secret", "headers", "active", "retryCount", "lastTriggeredAt", "createdAt", "updatedAt", "filters") SELECT "id", "sessionId", "url", "events", "secret", "headers", "active", "retryCount", "lastTriggeredAt", "createdAt", "updatedAt", "filters" FROM "webhooks"`,
    );
    await queryRunner.query(`DROP TABLE "webhooks"`);
    await queryRunner.query(`ALTER TABLE "temporary_webhooks" RENAME TO "webhooks"`);
    await queryRunner.query(
      `CREATE TABLE "marketing_contacts" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "phone" varchar NOT NULL, "tags" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "campaigns" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "status" varchar NOT NULL DEFAULT ('draft'), "audience" varchar NOT NULL, "sentCount" integer NOT NULL DEFAULT (0), "totalCount" integer NOT NULL DEFAULT (0), "templateId" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_sessions" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(100) NOT NULL, "status" varchar(50) NOT NULL DEFAULT ('created'), "phone" varchar(20), "pushName" varchar(100), "config" text NOT NULL DEFAULT ('{}'), "proxyUrl" varchar(255), "proxyType" varchar(10), "connectedAt" text, "lastActiveAt" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_ac984ccbd8b01af155e1874e8cb" UNIQUE ("name"))`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_sessions"("id", "name", "status", "phone", "pushName", "config", "proxyUrl", "proxyType", "connectedAt", "lastActiveAt", "createdAt", "updatedAt") SELECT "id", "name", "status", "phone", "pushName", "config", "proxyUrl", "proxyType", "connectedAt", "lastActiveAt", "createdAt", "updatedAt" FROM "sessions"`,
    );
    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(`ALTER TABLE "temporary_sessions" RENAME TO "sessions"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_webhooks" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "url" varchar(2048) NOT NULL, "events" text NOT NULL DEFAULT ('["message.received"]'), "secret" varchar(255), "headers" text NOT NULL DEFAULT ('{}'), "active" boolean NOT NULL DEFAULT (1), "retryCount" integer NOT NULL DEFAULT (3), "lastTriggeredAt" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "filters" text, CONSTRAINT "FK_d209715bb62b12255e825580af6" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_webhooks"("id", "sessionId", "url", "events", "secret", "headers", "active", "retryCount", "lastTriggeredAt", "createdAt", "updatedAt", "filters") SELECT "id", "sessionId", "url", "events", "secret", "headers", "active", "retryCount", "lastTriggeredAt", "createdAt", "updatedAt", "filters" FROM "webhooks"`,
    );
    await queryRunner.query(`DROP TABLE "webhooks"`);
    await queryRunner.query(`ALTER TABLE "temporary_webhooks" RENAME TO "webhooks"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_message_batches" ("id" varchar PRIMARY KEY NOT NULL, "batch_id" varchar NOT NULL, "session_id" varchar NOT NULL, "status" varchar NOT NULL DEFAULT ('pending'), "messages" text NOT NULL, "options" text, "progress" text, "results" text, "current_index" integer NOT NULL DEFAULT (0), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')), "started_at" text, "completed_at" text, CONSTRAINT "UQ_ff274470c0dbaff6c7d1f9795f5" UNIQUE ("batch_id"))`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_message_batches"("id", "batch_id", "session_id", "status", "messages", "options", "progress", "results", "current_index", "created_at", "updated_at", "started_at", "completed_at") SELECT "id", "batch_id", "session_id", "status", "messages", "options", "progress", "results", "current_index", "created_at", "updated_at", "started_at", "completed_at" FROM "message_batches"`,
    );
    await queryRunner.query(`DROP TABLE "message_batches"`);
    await queryRunner.query(`ALTER TABLE "temporary_message_batches" RENAME TO "message_batches"`);
    await queryRunner.query(`CREATE INDEX "IDX_1e39479a7a8aa37eab08df013b" ON "lid_mappings" ("phone") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ae44b476c522450bd395615a7c" ON "baileys_stored_messages" ("sessionId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1bb396e881628cd4dc8f0d2a8b" ON "baileys_stored_messages" ("sessionId", "waMessageId") `,
    );
    await queryRunner.query(`DROP INDEX "IDX_ae44b476c522450bd395615a7c"`);
    await queryRunner.query(`DROP INDEX "IDX_1bb396e881628cd4dc8f0d2a8b"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_baileys_stored_messages" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "waMessageId" varchar NOT NULL, "serializedMessage" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_55c1dfd945d2c552a5313b25460" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_baileys_stored_messages"("id", "sessionId", "waMessageId", "serializedMessage", "createdAt") SELECT "id", "sessionId", "waMessageId", "serializedMessage", "createdAt" FROM "baileys_stored_messages"`,
    );
    await queryRunner.query(`DROP TABLE "baileys_stored_messages"`);
    await queryRunner.query(`ALTER TABLE "temporary_baileys_stored_messages" RENAME TO "baileys_stored_messages"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_ae44b476c522450bd395615a7c" ON "baileys_stored_messages" ("sessionId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1bb396e881628cd4dc8f0d2a8b" ON "baileys_stored_messages" ("sessionId", "waMessageId") `,
    );
    await queryRunner.query(`DROP INDEX "IDX_templates_session_name"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_templates" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "name" varchar(100) NOT NULL, "body" text NOT NULL, "header" text, "footer" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_53208331c90e332d3f13780729c" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_templates"("id", "sessionId", "name", "body", "header", "footer", "createdAt", "updatedAt") SELECT "id", "sessionId", "name", "body", "header", "footer", "createdAt", "updatedAt" FROM "templates"`,
    );
    await queryRunner.query(`DROP TABLE "templates"`);
    await queryRunner.query(`ALTER TABLE "temporary_templates" RENAME TO "templates"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_templates_session_name" ON "templates" ("sessionId", "name") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(`DROP TABLE IF EXISTS "campaigns"`);
      await queryRunner.query(`DROP TABLE IF EXISTS "marketing_contacts"`);
      return;
    }

    await queryRunner.query(`DROP INDEX "IDX_templates_session_name"`);
    await queryRunner.query(`ALTER TABLE "templates" RENAME TO "temporary_templates"`);
    await queryRunner.query(
      `CREATE TABLE "templates" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "name" varchar(100) NOT NULL, "body" text NOT NULL, "header" text, "footer" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "templates"("id", "sessionId", "name", "body", "header", "footer", "createdAt", "updatedAt") SELECT "id", "sessionId", "name", "body", "header", "footer", "createdAt", "updatedAt" FROM "temporary_templates"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_templates"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_templates_session_name" ON "templates" ("sessionId", "name") `);
    await queryRunner.query(`DROP INDEX "IDX_1bb396e881628cd4dc8f0d2a8b"`);
    await queryRunner.query(`DROP INDEX "IDX_ae44b476c522450bd395615a7c"`);
    await queryRunner.query(`ALTER TABLE "baileys_stored_messages" RENAME TO "temporary_baileys_stored_messages"`);
    await queryRunner.query(
      `CREATE TABLE "baileys_stored_messages" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "waMessageId" varchar NOT NULL, "serializedMessage" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "baileys_stored_messages"("id", "sessionId", "waMessageId", "serializedMessage", "createdAt") SELECT "id", "sessionId", "waMessageId", "serializedMessage", "createdAt" FROM "temporary_baileys_stored_messages"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_baileys_stored_messages"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1bb396e881628cd4dc8f0d2a8b" ON "baileys_stored_messages" ("sessionId", "waMessageId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae44b476c522450bd395615a7c" ON "baileys_stored_messages" ("sessionId", "createdAt") `,
    );
    await queryRunner.query(`DROP INDEX "IDX_1bb396e881628cd4dc8f0d2a8b"`);
    await queryRunner.query(`DROP INDEX "IDX_ae44b476c522450bd395615a7c"`);
    await queryRunner.query(`DROP INDEX "IDX_1e39479a7a8aa37eab08df013b"`);
    await queryRunner.query(`ALTER TABLE "message_batches" RENAME TO "temporary_message_batches"`);
    await queryRunner.query(
      `CREATE TABLE "message_batches" ("id" varchar PRIMARY KEY NOT NULL, "batch_id" varchar NOT NULL, "session_id" varchar NOT NULL, "status" varchar NOT NULL DEFAULT ('pending'), "messages" text NOT NULL, "options" text, "progress" text, "results" text, "current_index" integer NOT NULL DEFAULT (0), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')), "started_at" datetime, "completed_at" datetime, CONSTRAINT "UQ_ff274470c0dbaff6c7d1f9795f5" UNIQUE ("batch_id"))`,
    );
    await queryRunner.query(
      `INSERT INTO "message_batches"("id", "batch_id", "session_id", "status", "messages", "options", "progress", "results", "current_index", "created_at", "updated_at", "started_at", "completed_at") SELECT "id", "batch_id", "session_id", "status", "messages", "options", "progress", "results", "current_index", "created_at", "updated_at", "started_at", "completed_at" FROM "temporary_message_batches"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_message_batches"`);
    await queryRunner.query(`ALTER TABLE "webhooks" RENAME TO "temporary_webhooks"`);
    await queryRunner.query(
      `CREATE TABLE "webhooks" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "url" varchar(2048) NOT NULL, "events" text NOT NULL DEFAULT ('["message.received"]'), "secret" varchar(255), "headers" text NOT NULL DEFAULT ('{}'), "active" boolean NOT NULL DEFAULT (1), "retryCount" integer NOT NULL DEFAULT (3), "lastTriggeredAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "filters" text, CONSTRAINT "FK_d209715bb62b12255e825580af6" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "webhooks"("id", "sessionId", "url", "events", "secret", "headers", "active", "retryCount", "lastTriggeredAt", "createdAt", "updatedAt", "filters") SELECT "id", "sessionId", "url", "events", "secret", "headers", "active", "retryCount", "lastTriggeredAt", "createdAt", "updatedAt", "filters" FROM "temporary_webhooks"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_webhooks"`);
    await queryRunner.query(`ALTER TABLE "sessions" RENAME TO "temporary_sessions"`);
    await queryRunner.query(
      `CREATE TABLE "sessions" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(100) NOT NULL, "status" varchar(50) NOT NULL DEFAULT ('created'), "phone" varchar(20), "pushName" varchar(100), "config" text NOT NULL DEFAULT ('{}'), "proxyUrl" varchar(255), "proxyType" varchar(10), "connectedAt" datetime, "lastActiveAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_ac984ccbd8b01af155e1874e8cb" UNIQUE ("name"))`,
    );
    await queryRunner.query(
      `INSERT INTO "sessions"("id", "name", "status", "phone", "pushName", "config", "proxyUrl", "proxyType", "connectedAt", "lastActiveAt", "createdAt", "updatedAt") SELECT "id", "name", "status", "phone", "pushName", "config", "proxyUrl", "proxyType", "connectedAt", "lastActiveAt", "createdAt", "updatedAt" FROM "temporary_sessions"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_sessions"`);
    await queryRunner.query(`DROP TABLE "campaigns"`);
    await queryRunner.query(`DROP TABLE "marketing_contacts"`);
    await queryRunner.query(`ALTER TABLE "webhooks" RENAME TO "temporary_webhooks"`);
    await queryRunner.query(
      `CREATE TABLE "webhooks" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "url" varchar(2048) NOT NULL, "events" text NOT NULL DEFAULT ('["message.received"]'), "secret" varchar(255), "headers" text NOT NULL DEFAULT ('{}'), "active" boolean NOT NULL DEFAULT (1), "retryCount" integer NOT NULL DEFAULT (3), "lastTriggeredAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "filters" text, CONSTRAINT "FK_d209715bb62b12255e825580af6" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "webhooks"("id", "sessionId", "url", "events", "secret", "headers", "active", "retryCount", "lastTriggeredAt", "createdAt", "updatedAt", "filters") SELECT "id", "sessionId", "url", "events", "secret", "headers", "active", "retryCount", "lastTriggeredAt", "createdAt", "updatedAt", "filters" FROM "temporary_webhooks"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_webhooks"`);
    await queryRunner.query(`CREATE INDEX "IDX_templates_sessionId" ON "templates" ("sessionId") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_baileys_stored_messages_session_wamsg" ON "baileys_stored_messages" ("sessionId", "waMessageId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_baileys_stored_messages_session_created" ON "baileys_stored_messages" ("sessionId", "createdAt") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_lid_mappings_phone" ON "lid_mappings" ("phone") `);
    await queryRunner.query(`DROP INDEX "IDX_templates_sessionId"`);
    await queryRunner.query(`DROP INDEX "IDX_templates_session_name"`);
    await queryRunner.query(`ALTER TABLE "templates" RENAME TO "temporary_templates"`);
    await queryRunner.query(
      `CREATE TABLE "templates" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "name" varchar(100) NOT NULL, "body" text NOT NULL, "header" text, "footer" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_templates_sessionId" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "templates"("id", "sessionId", "name", "body", "header", "footer", "createdAt", "updatedAt") SELECT "id", "sessionId", "name", "body", "header", "footer", "createdAt", "updatedAt" FROM "temporary_templates"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_templates"`);
    await queryRunner.query(`CREATE INDEX "IDX_templates_sessionId" ON "templates" ("sessionId") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_templates_session_name" ON "templates" ("sessionId", "name") `);
    await queryRunner.query(`DROP INDEX "UQ_baileys_stored_messages_session_wamsg"`);
    await queryRunner.query(`DROP INDEX "IDX_baileys_stored_messages_session_created"`);
    await queryRunner.query(`ALTER TABLE "baileys_stored_messages" RENAME TO "temporary_baileys_stored_messages"`);
    await queryRunner.query(
      `CREATE TABLE "baileys_stored_messages" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "waMessageId" varchar NOT NULL, "serializedMessage" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_baileys_stored_messages_sessionId" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "baileys_stored_messages"("id", "sessionId", "waMessageId", "serializedMessage", "createdAt") SELECT "id", "sessionId", "waMessageId", "serializedMessage", "createdAt" FROM "temporary_baileys_stored_messages"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_baileys_stored_messages"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_baileys_stored_messages_session_wamsg" ON "baileys_stored_messages" ("sessionId", "waMessageId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_baileys_stored_messages_session_created" ON "baileys_stored_messages" ("sessionId", "createdAt") `,
    );
  }
}
