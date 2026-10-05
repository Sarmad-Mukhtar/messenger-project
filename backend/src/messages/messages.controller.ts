import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { MessagesService } from './messages.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface JwtRequest extends Request {
  user: {
    userId: string;
    email: string;
    username: string;
  };
}

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
  ) {}

  // =========================================================
  // 1. Send a message
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Post()
  sendMessage(
    @Req() request: JwtRequest,
    @Body()
    body: {
      receiverId: string;
      content: string;
      replyToId?: string;
    },
  ) {
    return this.messagesService.sendMessage(
      request.user.userId,
      body.receiverId,
      body.content,
      body.replyToId,
    );
  }

  // =========================================================
  // 2. Get all conversations
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get('conversations')
  getConversations(@Req() request: JwtRequest) {
    return this.messagesService.getConversations(
      request.user.userId,
    );
  }

  // =========================================================
  // 3. Get or create a conversation with a friend
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:userId')
  getOrCreateConversation(
    @Req() request: JwtRequest,
    @Param('userId') userId: string,
  ) {
    return this.messagesService.getOrCreateConversation(
      request.user.userId,
      userId,
    );
  }

  // =========================================================
  // 4. Delete a conversation
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Delete('conversations/:conversationId')
  deleteConversation(
    @Req() request: JwtRequest,
    @Param('conversationId') conversationId: string,
  ) {
    return this.messagesService.deleteConversation(
      request.user.userId,
      conversationId,
    );
  }

  // =========================================================
  // 5. Edit a message
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Patch(':messageId')
  editMessage(
    @Req() request: JwtRequest,
    @Param('messageId') messageId: string,
    @Body()
    body: {
      content: string;
    },
  ) {
    return this.messagesService.editMessage(
      request.user.userId,
      messageId,
      body.content,
    );
  }

  // =========================================================
  // 6. Delete message for me
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Delete(':messageId/me')
  deleteMessageForMe(
    @Req() request: JwtRequest,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.deleteMessageForMe(
      request.user.userId,
      messageId,
    );
  }

  // =========================================================
  // 7. Delete message for everyone
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Delete(':messageId/everyone')
  deleteMessageForEveryone(
    @Req() request: JwtRequest,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.deleteMessageForEveryone(
      request.user.userId,
      messageId,
    );
  }

  // =========================================================
  // 8. Mark messages as read
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Post(':conversationId/read')
  markConversationAsRead(
    @Req() request: JwtRequest,
    @Param('conversationId') conversationId: string,
  ) {
    return this.messagesService.markConversationAsRead(
      request.user.userId,
      conversationId,
    );
  }

  // =========================================================
  // 9. Search messages in a conversation
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get(':conversationId/search')
  searchMessages(
    @Req() request: JwtRequest,
    @Param('conversationId') conversationId: string,
    @Query('q') query?: string,
  ) {
    return this.messagesService.searchMessages(
      request.user.userId,
      conversationId,
      query ?? '',
    );
  }

  // =========================================================
  // 10. Get messages from one conversation
  //     WITH PAGINATION
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get(':conversationId')
  getConversationMessages(
    @Req() request: JwtRequest,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const parsedLimit = limit
      ? Number.parseInt(limit, 10)
      : 30;

    return this.messagesService.getConversationMessages(
      request.user.userId,
      conversationId,
      Number.isNaN(parsedLimit)
        ? 30
        : parsedLimit,
      before,
    );
  }

  // =========================================================
  // 11. Add or change a message reaction
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Post(':messageId/reaction')
  reactToMessage(
    @Req() request: JwtRequest,
    @Param('messageId') messageId: string,
    @Body()
    body: {
      emoji: string;
    },
  ) {
    return this.messagesService.reactToMessage(
      request.user.userId,
      messageId,
      body.emoji,
    );
  }

  // =========================================================
  // 12. Remove your reaction from a message
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Delete(':messageId/reaction')
  removeReaction(
    @Req() request: JwtRequest,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.removeReaction(
      request.user.userId,
      messageId,
    );
  }

  // =========================================================
  // 13. Get reactions for a message
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get(':messageId/reactions')
  getMessageReactions(
    @Req() request: JwtRequest,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.getMessageReactions(
      request.user.userId,
      messageId,
    );
  }

  // =========================================================
  // 14. Pin a message
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Post(':messageId/pin')
  pinMessage(
    @Req() request: JwtRequest,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.pinMessage(
      request.user.userId,
      messageId,
    );
  }

  // =========================================================
  // 15. Unpin a message
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Post(':messageId/unpin')
  unpinMessage(
    @Req() request: JwtRequest,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.unpinMessage(
      request.user.userId,
      messageId,
    );
  }

  // =========================================================
  // 16. Get pinned messages in a conversation
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get(':conversationId/pinned')
  getPinnedMessages(
    @Req() request: JwtRequest,
    @Param('conversationId') conversationId: string,
  ) {
    return this.messagesService.getPinnedMessages(
      request.user.userId,
      conversationId,
    );
  }

  // =========================================================
  // 17. Forward a message
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Post(':messageId/forward')
  forwardMessage(
    @Req() request: JwtRequest,
    @Param('messageId') messageId: string,
    @Body()
    body: {
      receiverId: string;
    },
  ) {
    return this.messagesService.forwardMessage(
      request.user.userId,
      messageId,
      body.receiverId,
    );
  }
}
