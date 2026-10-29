import { getCity, listCities } from '../../routes/cities';
import { JwtAuthGuard } from '../auth-core/jwt-auth.guard';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

@Controller('api/cities')
@UseGuards(JwtAuthGuard)
export class CitiesController {
  @Get()
  list(@Query() query: Record<string, unknown>) {
    return listCities(query);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return getCity(slug);
  }
}
