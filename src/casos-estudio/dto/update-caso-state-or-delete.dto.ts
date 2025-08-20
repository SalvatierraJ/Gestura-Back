import {
  IsBoolean,
  IsOptional,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'OneActionOnly', async: false })
export class OneActionOnly implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const obj = args.object as any;
    const hasEstado = typeof obj.estado === 'boolean';
    const hasDelete = typeof obj.delete === 'boolean';
    return (hasEstado || hasDelete) && !(hasEstado && hasDelete);
  }
  defaultMessage() {
    return 'Debes enviar exactamente uno de los campos: "estado" (boolean) o "delete" (boolean).';
  }
}

export class UpdateCasoStateOrDeleteDto {
  @Validate(OneActionOnly)
  private readonly _xor!: never;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;


  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}
