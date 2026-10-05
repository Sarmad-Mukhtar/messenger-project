import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMessageAttachments(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: {
        id: messageId,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return this.prisma.messageAttachment.findMany({
      where: {
        messageId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async createAttachment(
    messageId: string,
    fileName: string,
    fileUrl: string,
    mimeType: string,
    fileSize: number,
  ) {
    if (!fileName || !fileUrl || !mimeType) {
      throw new BadRequestException('Attachment information is incomplete');
    }

    const message = await this.prisma.message.findUnique({
      where: {
        id: messageId,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return this.prisma.messageAttachment.create({
      data: {
        messageId,
        fileName,
        fileUrl,
        mimeType,
        fileSize,
      },
    });
  }

  async deleteAttachment(attachmentId: string) {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: {
        id: attachmentId,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.prisma.messageAttachment.delete({
      where: {
        id: attachmentId,
      },
    });

    return {
      message: 'Attachment deleted successfully',
    };
  }
}
