import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { jsonColumnType } from '../../../common/utils/column-types';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  @Column()
  name: string;

  @Column({ default: 'draft' })
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed';

  @Column()
  audience: string;

  @Column({ default: 0 })
  sentCount: number;

  @Column({ default: 0 })
  totalSentCount: number;

  @Column({ default: 0 })
  totalCount: number;

  @Column({ nullable: true })
  templateId: string;

  @Column({ type: 'text', nullable: true })
  messageText: string;

  @Column({ nullable: true })
  mediaUrl: string;

  @Column({ nullable: true })
  mediaType: string;

  @Column({ type: jsonColumnType(), nullable: true })
  mediaUrls: string[] | null;

  @Column({ type: jsonColumnType(), nullable: true })
  mediaTypes: string[] | null;

  @Column({ nullable: true })
  sessionId: string;

  @CreateDateColumn()
  createdAt: Date;
}
