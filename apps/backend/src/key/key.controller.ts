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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { KeyService } from './key.service';
import { CreateKeyDto } from './dto/create-key.dto';
import { UpdateKeyDto } from './dto/update-key.dto';

@Controller('projects/:projectId/namespaces/:namespaceId/keys')
@UseGuards(AuthGuard('jwt'))
export class KeyController {
  constructor(private readonly keyService: KeyService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Body() createKeyDto: CreateKeyDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.keyService.create(
      projectId,
      namespaceId,
      createKeyDto,
      req.user.id,
    );
  }

  @Post('batch')
  createBatch(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Body() body: { keys: CreateKeyDto[] },
    @Request() req: { user: { id: string } },
  ) {
    if (!body.keys || !Array.isArray(body.keys) || body.keys.length === 0) {
      throw new BadRequestException('Keys array is required');
    }
    return this.keyService.createBatch(
      projectId,
      namespaceId,
      body.keys,
      req.user.id,
    );
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('id') id: string,
  ) {
    return this.keyService.remove(projectId, namespaceId, id);
  }

  @Get('export')
  async exportTranslations(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Query('format') format: 'json' | 'yaml' = 'json',
  ) {
    const content = await this.keyService.exportTranslations(
      projectId,
      namespaceId,
      format,
    );
    return {
      content,
      format,
      fileName: `translations.${format}`,
    };
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importTranslations(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('format') format: 'json' | 'yaml' = 'json',
    @Query('mode') mode: 'fillMissing' | 'overwrite' = 'fillMissing',
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const fileContent = file.buffer.toString('utf8');
    return this.keyService.importTranslations(
      projectId,
      namespaceId,
      fileContent,
      format,
      mode,
    );
  }
}
