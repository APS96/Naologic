import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = `mongodb://${configService.get<string>('DB_USER')}:${configService.get<string>('DB_PASSWORD')}@${configService.get<string>('DB_HOST')}`;
        console.log(uri);
        return {
          uri,
          dbName: `${configService.get<string>('DB_NAME')}`,
        };
      },
      inject: [ConfigService],
    }),
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
