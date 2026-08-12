import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsNumber, Min } from 'class-validator';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { User, UserRole } from './entities/user.entity';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  webhooksEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSessions?: number;

  @IsOptional()
  expiresAt?: string | Date | null;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  webhooksEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSessions?: number;

  @IsOptional()
  expiresAt?: string | Date | null;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'List all users' })
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Post()
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() body: CreateUserDto): Promise<any> {
    const { username, password, role, webhooksEnabled, isActive, maxSessions, expiresAt } = body;

    try {
      // Create the user
      const user = await this.usersService.create({
        username,
        passwordHash: password, // Note: passwordHash is mapped here
        role: role || UserRole.USER,
        webhooksEnabled: webhooksEnabled ?? false,
        isActive: isActive !== undefined ? isActive : true,
        maxSessions: maxSessions !== undefined ? maxSessions : 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      // Create an API Key for this user
      const { rawKey } = await this.authService.createApiKey({
        name: `${username}'s Key`,
        role: role === UserRole.ADMIN ? ApiKeyRole.ADMIN : ApiKeyRole.OPERATOR,
        userId: user.id,
      });

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        webhooksEnabled: user.webhooksEnabled,
        isActive: user.isActive,
        maxSessions: user.maxSessions,
        expiresAt: user.expiresAt,
        createdAt: user.createdAt,
        apiKey: rawKey, // Show the raw key only once
      };
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('Username already exists');
      }
      throw error;
    }
  }

  @Patch(':id')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Update a user' })
  async update(@Param('id') id: string, @Body() body: UpdateUserDto) {
    const { password, role, webhooksEnabled, isActive, maxSessions, expiresAt } = body;

    const updateData: Partial<User> = {};
    if (password && typeof password === 'string' && password.trim().length > 0) {
      updateData.passwordHash = password.trim();
    }
    if (role) updateData.role = role;
    if (webhooksEnabled !== undefined) updateData.webhooksEnabled = webhooksEnabled;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (maxSessions !== undefined) updateData.maxSessions = maxSessions;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    const user = await this.usersService.update(id, updateData);
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      webhooksEnabled: user.webhooksEnabled,
      isActive: user.isActive,
      maxSessions: user.maxSessions,
      expiresAt: user.expiresAt,
    };
  }

  @Delete(':id')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Delete a user' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}
