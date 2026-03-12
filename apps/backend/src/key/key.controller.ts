import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { KeyService } from './key.service';
import { CreateKeyDto } from './dto/create-key.dto';
import { UpdateKeyDto } from './dto/update-key.dto';

@Controller('projects/:projectId/namespaces/:namespaceId/keys')
export class KeyController {
  constructor(private readonly keyService: KeyService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Body() createKeyDto: CreateKeyDto,
  ) {
    return this.keyService.create(projectId, namespaceId, createKeyDto);
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
  ) {
    return this.keyService.findAll(projectId, namespaceId);
  }

  @Get('lookup')
  lookupByName(
    @Param('projectId') projectId: string,
    @Query('name') name: string,
    @Query('excludeKeyId') excludeKeyId?: string,
  ) {
    return this.keyService.lookupByName(projectId, name, excludeKeyId);
  }

  @Post(':keyId/copy-translations')
  copyTranslations(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') keyId: string,
    @Body()
    body: { sourceKeyId: string; mode?: 'fillMissing' | 'overwrite' },
  ) {
    return this.keyService.copyTranslations(
      projectId,
      namespaceId,
      keyId,
      body.sourceKeyId,
      body.mode,
    );
  }

  @Get(':keyId')
  findOne(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') id: string,
  ) {
    return this.keyService.findOne(projectId, namespaceId, id);
  }

  @Patch(':keyId')
  update(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') id: string,
    @Body() updateKeyDto: UpdateKeyDto,
  ) {
    return this.keyService.update(projectId, namespaceId, id, updateKeyDto);
  }

  @Delete(':keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') id: string,
  ) {
    return this.keyService.remove(projectId, namespaceId, id);
  }
}
