import { Document } from "mongoose";

export enum AuthStatus {
  Logined,
  NotFound,
  WrongPass,
  Error,
  LeftAttempts,
  Blocked,
  NotActive,
  SendCode,
  UserExists,
  WrongEmail,
  WrongConfirmCode,
}

type CodeType = {
  code?: string | number;
};

export interface EmailDto {
  email: string;
}

export interface LoginDto extends EmailDto {
  password: string;
}

export interface ConfirmDto extends EmailDto {
  password?: string;
  code: string | number;
}

export type LoginResponseType = BaseResponseType &
  CodeType & {
    leftAttempts?: any;
    user?: any & Document;
    jwt?: string;
  };

export type ConfirmCodeResponseType = BaseResponseType & {
  user?: any & Document;
  jwt?: string;
};

export type ForgotResponseType = BaseResponseType & CodeType;

export type AuthResponseType = BaseResponseType & {
  status: AuthStatus.Error | AuthStatus.Logined | AuthStatus.NotFound;
  user?: any & Document;
  jwt?: string;
};

export type BaseResponseType = {
  status: AuthStatus;
  error?: Error;
};

export interface IUserProperties {
  email: string;
  pass: string;
  isActive: string;
  isBlock: string;
  attempts: string;
  code: string;
}

export type NMAModuleSetupOptions = {
  userProjection: Object;
  userProperties: IUserProperties;
  codeGenerator: Function;
  hashPassword: Function;
};
