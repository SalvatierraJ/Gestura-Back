// gemini.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config'
@Injectable()
export class GeminiService {
    private readonly endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    private apiKey: string;

    constructor(private config: ConfigService) {
        const apiKey = this.config.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not defined in environment variables');
        }
        this.apiKey = apiKey;
    }


    async consultarGemini(prompt: string): Promise<string> {
        const response = await axios.post(
            `${this.endpoint}?key=${this.apiKey}`,
            {
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
    }
}
