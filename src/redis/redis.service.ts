import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis, { Redis as RedisType } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisType;

  onModuleInit() {
    this.client = new Redis({
      host: process.env.HOST_REDDIS || 'localhost',
      port: parseInt(process.env.PORT_REDDIS ?? '6379', 10),
      retryStrategy: (times) => {
        if (times === 1) {
          return 100;
        }
       
        return null;
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err);
      this.client.disconnect();
    });


    this.client.on('end', () => {
      console.log('Redis connection closed.');
    });
  }


  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  async setChatHistory(userId: string, history: any[]) {
    await this.client.set(`chat:${userId}:history`, JSON.stringify(history));
  }

  async getChatHistory(userId: string): Promise<any[]> {
    const data = await this.client.get(`chat:${userId}:history`);
    return data ? JSON.parse(data) : [];
  }

  async setChatContext(userId: string, context: any) {
    await this.client.set(`chat:${userId}:context`, JSON.stringify(context));
  }

  async getChatContext(userId: string): Promise<any> {
    const data = await this.client.get(`chat:${userId}:context`);
    return data ? JSON.parse(data) : {};
  }
}
