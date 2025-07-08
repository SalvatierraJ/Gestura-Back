import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class CloudinaryService {
  constructor(@Inject('Cloudinary') private cloudinary) {}

  async uploadFile(file: Express.Multer.File) {
    return new Promise((resolve, reject) => {
      this.cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto', // permite subir cualquier tipo de archivo
          folder: 'documentos',  // opcional
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      ).end(file.buffer);
    });
  }
}
