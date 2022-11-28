import { Inject, Injectable } from "@nestjs/common";
import { Model, Types } from "mongoose";
import {
  AuthResponseType,
  AuthStatus,
  BaseResponseType,
  ConfirmCodeResponseType,
  ConfirmDto,
  EmailDto,
  ForgotResponseType,
  IUserProperties,
  LoginDto,
  LoginResponseType,
  NMAModuleSetupOptions,
} from "./nest-mongo-auth.dto";
import { NMA_MODULE_CONFIGS } from "./constants";
import { JWTService } from "nest-jwt-module";

type ID = string | Types.ObjectId;

@Injectable()
export class NestMongoAuthService<T> {
  private userProjection: Object;
  private userProps: IUserProperties;
  private codeGenerator: Function;
  private hashPassword: Function;

  constructor(
    @Inject(NMA_MODULE_CONFIGS) options: NMAModuleSetupOptions,
    private readonly jwtService: JWTService
  ) {
    this.userProjection = options.userProjection;
    this.userProps = options.userProperties;
    this.codeGenerator = options.codeGenerator;
    this.hashPassword = options.hashPassword;
  }

  async login(
    userModel: Model<any>,
    dto: LoginDto,
    maxAttempts: number
  ): Promise<LoginResponseType> {
    try {
      const userEx = await userModel.findOne({
        [this.userProps.email]: dto.email,
      });
      if (userEx) {
        const user = await userModel.findOne({
          [this.userProps.email]: dto.email,
          [this.userProps.pass]: this.hashPassword(dto.password),
        });
        if (user) {
          const isBlock = user.get(this.userProps.isBlock);
          if (isBlock) {
            return Promise.resolve({ status: AuthStatus.Blocked });
          }
          const isActive = user.get(this.userProps.isActive);
          if (!isActive) {
            const code = this.codeGenerator();
            await userModel.findOneAndUpdate(
              { [this.userProps.email]: dto.email },
              {
                [this.userProps.attempts]: 0,
                [this.userProps.code]: code,
              }
            );
            return Promise.resolve({ status: AuthStatus.SendCode, code });
          }
          const cleanUser = await userModel.findOneAndUpdate(
            { [this.userProps.email]: dto.email },
            { [this.userProps.attempts]: 0 },
            { new: true, projection: this.userProjection }
          );
          const dataToJWT = this.generateDataForJWT(user);
          const jwt = await this.jwtService.GenerateToken(dataToJWT);
          return Promise.resolve({
            status: AuthStatus.Logined,
            user: cleanUser,
            jwt,
          });
        } else {
          const isBlock = userEx.get(this.userProps.isBlock);
          if (isBlock) {
            return Promise.resolve({ status: AuthStatus.Blocked });
          } else {
            const attempts = userEx.get(this.userProps.attempts);
            if (attempts + 1 >= maxAttempts) {
              await userModel.findOneAndUpdate(
                { [this.userProps.email]: dto.email },
                {
                  [this.userProps.attempts]: maxAttempts,
                  [this.userProps.isBlock]: true,
                }
              );
              return Promise.resolve({ status: AuthStatus.Blocked });
            } else {
              await userModel.findOneAndUpdate(
                { [this.userProps.email]: dto.email },
                { [this.userProps.attempts]: attempts + 1 }
              );
              return Promise.resolve({
                status: AuthStatus.LeftAttempts,
                leftAttempts: maxAttempts - (attempts + 1),
              });
            }
          }
        }
      } else {
        return Promise.resolve({ status: AuthStatus.NotFound });
      }
    } catch (error) {
      return Promise.resolve({ status: AuthStatus.Error, error });
    }
  }

  async auth(userModel: Model<any>, userID: ID): Promise<AuthResponseType> {
    try {
      const user = await userModel.findById(userID, this.userProjection);
      if (user) {
        const dataToJWT = this.generateDataForJWT(user);
        const jwt = await this.jwtService.GenerateToken(dataToJWT);
        return Promise.resolve({ status: AuthStatus.Logined, user, jwt });
      } else {
        return Promise.resolve({ status: AuthStatus.NotFound });
      }
    } catch (error) {
      return Promise.resolve({ status: AuthStatus.Error, error });
    }
  }

  async register(
    userModel: Model<any>,
    dto: LoginDto,
    anyFields: any
  ): Promise<BaseResponseType> {
    try {
      const user = await userModel.findOne({
        [this.userProps.email]: dto.email,
      });
      if (!user) {
        const code = this.codeGenerator();
        await userModel.create({
          ...anyFields,
          [this.userProps.email]: dto.email,
          [this.userProps.pass]: this.hashPassword(dto.password),
          [this.userProps.code]: code,
        });
        return Promise.resolve({ status: AuthStatus.SendCode, code });
      } else {
        return Promise.resolve({ status: AuthStatus.UserExists });
      }
    } catch (error) {
      return Promise.resolve({ status: AuthStatus.Error, error });
    }
  }

  async forgotPass(
    userModel: Model<any>,
    dto: EmailDto
  ): Promise<ForgotResponseType> {
    try {
      const user = await userModel.findOne({
        [this.userProps.email]: dto.email,
      });
      if (user) {
        const code = this.codeGenerator();
        await userModel.findOneAndUpdate(
          { [this.userProps.email]: dto.email },
          { [this.userProps.code]: code }
        );
        return Promise.resolve({ status: AuthStatus.SendCode, code });
      } else {
        return Promise.resolve({ status: AuthStatus.WrongEmail });
      }
    } catch (error) {
      return Promise.resolve({ status: AuthStatus.Error, error });
    }
  }

  async confirmCode(
    userModel: Model<any>,
    dto: ConfirmDto
  ): Promise<ConfirmCodeResponseType> {
    try {
      const user = await userModel.findOne({
        [this.userProps.email]: dto.email,
        [this.userProps.code]: dto.code,
      });
      if (!user) {
        return Promise.resolve({ status: AuthStatus.WrongConfirmCode });
      } else {
        const pass = dto?.password
          ? { [this.userProps.pass]: this.hashPassword(dto.password) }
          : {};
        const updatedUser = await userModel.findByIdAndUpdate(
          user._id,
          {
            [this.userProps.code]: null,
            [this.userProps.isActive]: true,
            [this.userProps.attempts]: 0,
            ...pass,
          },
          { new: true, projection: this.userProjection }
        );
        const dataToJWT = this.generateDataForJWT(updatedUser);
        const jwt = await this.jwtService.GenerateToken(dataToJWT);
        return Promise.resolve({
          status: AuthStatus.Logined,
          user: updatedUser,
          jwt,
        });
      }
    } catch (error) {
      return Promise.resolve({ status: AuthStatus.Error, error });
    }
  }

  private generateDataForJWT(user: any): Object {
    const data = { id: user._id };
    return data;
  }
}
