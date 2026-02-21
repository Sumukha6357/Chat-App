import { Injectable } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  createUser(data: Partial<User>) {
    return this.usersRepo.create(data);
  }

  findByEmail(email: string) {
    return this.usersRepo.findByEmail(email);
  }

  findByUsername(username: string) {
    return this.usersRepo.findByUsername(username);
  }

  findById(id: string) {
    return this.usersRepo.findById(id);
  }

  updateStatus(userId: string, status: User['status'], lastSeen?: Date) {
    return this.usersRepo.updateStatus(userId, status, lastSeen);
  }

  hasBlocked(userId: string, targetUserId: string) {
    return this.usersRepo.hasBlocked(userId, targetUserId);
  }

  blockUser(userId: string, targetUserId: string) {
    return this.usersRepo.blockUser(userId, targetUserId);
  }

  unblockUser(userId: string, targetUserId: string) {
    return this.usersRepo.unblockUser(userId, targetUserId);
  }
}
