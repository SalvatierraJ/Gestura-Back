import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { userEntity } from './user';
import { JwtService } from '@nestjs/jwt';
import { PayloadEntity } from './peyload';
import { LoginUserDto } from 'src/user/dto/login-user.dto';

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
        const payload:PayloadEntity = { username: user.Nombre_Usuario, sub: Number(user.Id_Usuario) };
        return {
            access_token: this.jwtService.sign(payload),
        };
    };
}
