import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // ✅ Obtener URL de la request
    const request = context.switchToHttp().getRequest();
    const url = request.url;
    
    // ✅ Excluir endpoints de archivos/descarga
    if (url.includes('/plantillas/user/') || 
        url.includes('/download') || 
        url.includes('/file') || 
        url.includes('/export')) {
      console.log(`🔄 BigIntInterceptor: Saltando endpoint de archivo: ${url}`);
      return next.handle(); 
    }

    return next.handle().pipe(
      map((data) => {
        if (data === undefined || data === null) {
          return data;
        }
        
        if (Buffer.isBuffer(data)) {
          return data;
        }

        try {
          if (typeof data === 'object') {
            return JSON.parse(JSON.stringify(data, (key, value) => {
              return typeof value === 'bigint' ? value.toString() : value;
            }));
          }
          return data;
        } catch (error) {
          console.warn('BigIntInterceptor: Error serializando:', error);
          return data; 
        }
      })
    );
  }
}