import { Injectable } from '@nestjs/common';

@Injectable()
export class CeleryService {
  private readonly celeryApiUrl = 'http://127.0.0.1:8000';

  async sendTestTask() {
    const response = await fetch(`${this.celeryApiUrl}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Celery API returned ${response.status}`);
    }

    return response.json();
  }

  async sendMessageNotification(
    senderId: string,
    receiverId: string,
    messageContent: string,
  ) {
    const response = await fetch(
      `${this.celeryApiUrl}/message-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId,
          receiverId,
          messageContent,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Celery API returned ${response.status}`);
    }

    return response.json();
  }
}
