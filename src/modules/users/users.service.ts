import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { ApiKey } from '../auth/entities/api-key.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User, 'main')
    private readonly userRepository: Repository<User>,
    @InjectRepository(ApiKey, 'main')
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async findByActiveLoginToken(token: string): Promise<User | null> {
    if (!token) return null;
    return this.userRepository.findOne({ where: { activeLoginToken: token } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    // Omitting passwordHash from the results
    return this.userRepository.find({
      select: ['id', 'username', 'role', 'webhooksEnabled', 'isActive', 'maxSessions', 'expiresAt', 'createdAt', 'updatedAt'],
    });
  }

  async create(data: Partial<User>): Promise<User> {
    if (data.username) {
      data.username = data.username.trim();
      const existing = await this.findByUsername(data.username);
      if (existing) {
        throw new ConflictException('Username already exists');
      }
    }

    const user = new User();
    Object.assign(user, data);

    if (data.passwordHash) {
      user.passwordHash = await bcrypt.hash(data.passwordHash.trim(), 10);
    }

    return this.userRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (data.username) {
      data.username = data.username.trim();
      if (data.username !== user.username) {
        const existing = await this.findByUsername(data.username);
        if (existing) {
          throw new ConflictException('Username already exists');
        }
      }
    }

    // Extract password hash separately so Object.assign doesn't overwrite with raw text
    const plainPassword = data.passwordHash;
    delete data.passwordHash;

    Object.assign(user, data);

    if (plainPassword && plainPassword.trim()) {
      user.passwordHash = await bcrypt.hash(plainPassword.trim(), 10);
    }

    const savedUser = await this.userRepository.save(user);

    // Synchronize linked ApiKeys if user expiration or active status changed
    if (data.expiresAt !== undefined || data.isActive !== undefined) {
      const apiKeyUpdates: Partial<ApiKey> = {};
      if (data.expiresAt !== undefined) {
        apiKeyUpdates.expiresAt = data.expiresAt;
      }
      if (data.isActive !== undefined && data.isActive === true) {
        apiKeyUpdates.isActive = true;
      }
      await this.apiKeyRepository.update({ userId: id }, apiKeyUpdates);
    }

    return savedUser;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.userRepository.remove(user);
  }

  async count(): Promise<number> {
    return this.userRepository.count();
  }
}
