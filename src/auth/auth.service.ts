import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { userEntity } from './user';
import { JwtService } from '@nestjs/jwt';
import { PayloadEntity } from './peyload';
import { LoginUserDto } from 'src/user/dto/login-user.dto';
import * as jwt from "jsonwebtoken";

@Injectable()
export class AuthService {

    constructor(private userServices: UserService, private jwtService: JwtService) { }

    async validateUser(body: LoginUserDto) {
        try {
            const user = await this.userServices.findOneUser(body.Nombre_Usuario);

            const matchResult = await bcrypt.compare(body.Password, user?.Password ?? '');
            if (user && matchResult) {
                const { Password, ...result } = user;
                return result;
            }
            return null;
        } catch (error) {
            if (error instanceof Error) {
                throw new InternalServerErrorException(error.message);
            }

        }
    };

    async login(user: userEntity) {
        const payload: PayloadEntity = { username: user.Nombre_Usuario, sub: Number(user.Id_Usuario) };
        return {
            access_token: this.jwtService.sign(payload),
        };
    };

   async loginOrRegisterOauthUser(id_token: string) {
    const decoded: any = jwt.decode(id_token);
    const { email, name } = decoded;
    if (!email) throw new Error("No se recibió correo desde Auth0");

    const user = await this.userServices.createOrGetOauthUser({ email, name });

    const payloadToken = { username: user.Nombre_Usuario, sub: Number(user.Id_Usuario) };
    return {
        access_token: this.jwtService.sign(payloadToken),
        user,
    };
}


}
