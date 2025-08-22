import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

export const multerConfig = {
  storage: diskStorage({
    destination: './uploads/plantillas', 
    filename: (req, file, callback) => {
      const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
      callback(null, uniqueName);
    },
  }),
  fileFilter: (req, file, callback) => {

    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
      'application/xlsx', 
      
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      
      'application/pdf',
      
      'text/plain',
      'text/csv',
      
      'application/octet-stream' 
    ];

    const allowedExtensions = ['.xlsx', '.xls', '.docx', '.doc', '.pdf', '.txt', '.csv'];
    const fileExtension = extname(file.originalname).toLowerCase();
    
    const isValidMime = allowedMimes.includes(file.mimetype);
    const isValidExtension = allowedExtensions.includes(fileExtension);
    
    if (isValidMime || isValidExtension) {
      callback(null, true);
    } else {
      callback(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Archivo: ${file.originalname}`), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
};
