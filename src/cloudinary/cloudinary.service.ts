import { Injectable, Inject } from '@nestjs/common';
import * as path from 'path';

@Injectable()
export class CloudinaryService {
  constructor(@Inject('Cloudinary') private cloudinary) {}

  private isWord(mime: string) {
    return /application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)/i.test(
      mime || ''
    );
  }

  private sanitizeName(name: string) {
    return (name || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async uploadFile(file: Express.Multer.File) {
    return new Promise((resolve, reject) => {
      const folder = 'documentos';

      // Opciones base (tu lógica actual)
      let opts: any = {
        resource_type: 'auto',
        folder,
      };

      // Si es Word, sube como "raw" y conserva extensión en la URL
      if (this.isWord(file?.mimetype)) {
        const parsed = path.parse(file?.originalname || 'archivo');
        const ext =
          parsed.ext ||
          (file.mimetype.includes('openxml') ? '.docx' : '.doc'); // fallback
        const publicId = `${this.sanitizeName(parsed.name)}${ext}`;

        opts = {
          folder,
          resource_type: 'raw',
          public_id: publicId, // aparecerá como .../raw/upload/.../mi_archivo.docx
          overwrite: true,
        };
      }

      this.cloudinary.uploader
        .upload_stream(opts, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        })
        .end(file.buffer);
    });
  }
}
