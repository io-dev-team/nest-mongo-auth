import { DynamicModule, Module } from "@nestjs/common";
import { NMA_MODULE_CONFIGS } from "./constants";
import { NMAModuleSetupOptions } from "./nest-mongo-auth.dto";
import { NestMongoAuthService } from "./nest-mongo-auth.service";

@Module({})
export class NestMongoAuthModule {
  static forRoot(options: NMAModuleSetupOptions): DynamicModule {
    return {
      module: NestMongoAuthModule,
      imports: [],
      providers: [{ provide: NMA_MODULE_CONFIGS, useValue: options }, NestMongoAuthService],
      exports: [NestMongoAuthService],
    };
  }
}
