import { CitiesController } from './cities.controller';
import { Module } from '@nestjs/common';

@Module({
  controllers: [CitiesController],
})
export class CitiesModule {}
