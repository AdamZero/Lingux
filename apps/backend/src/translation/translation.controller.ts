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
} from '@nestjs/common';
import { TranslationService } from './translation.service';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';

@Controller(
  'projects/:projectId/namespaces/:namespaceId/keys/:keyId/translations',
)
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') keyId: string,
    @Body() createTranslationDto: CreateTranslationDto,
  ) {
    return this.translationService.create(
      projectId,
      namespaceId,
      keyId,
      createTranslationDto,
    );
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') keyId: string,
  ) {
    return this.translationService.findAll(projectId, namespaceId, keyId);
  }

  @Get(':localeCode')
  findOne(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') keyId: string,
    @Param('localeCode') localeCode: string,
  ) {
    return this.translationService.findOne(
      projectId,
      namespaceId,
      keyId,
      localeCode,
    );
  }

  @Patch(':localeCode')
  update(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') keyId: string,
    @Param('localeCode') localeCode: string,
    @Body() updateTranslationDto: UpdateTranslationDto,
  ) {
    return this.translationService.update(
      projectId,
      namespaceId,
      keyId,
      localeCode,
      updateTranslationDto,
    );
  }

  @Post('batch')
  async batchUpdate(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') keyId: string,
    @Body()
    body: {
      translations: Array<{
        localeCode: string;
        content: string;
        status?: string;
      }>;
    },
  ) {
    return this.translationService.batchUpdate(
      projectId,
      namespaceId,
      keyId,
      body.translations,
    );
  }

  @Post(':localeCode/approve')
  approve(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') keyId: string,
    @Param('localeCode') localeCode: string,
  ) {
    return this.translationService.approve(
      projectId,
      namespaceId,
      keyId,
      localeCode,
    );
  }

  @Post(':localeCode/reject')
  reject(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') keyId: string,
    @Param('localeCode') localeCode: string,
    @Body('reason') reason: string,
  ) {
    return this.translationService.reject(
      projectId,
      namespaceId,
      keyId,
      localeCode,
      reason,
    );
  }

  @Post(':localeCode/submit-review')
  submitReview(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') keyId: string,
    @Param('localeCode') localeCode: string,
  ) {
    return this.translationService.submitReview(
      projectId,
      namespaceId,
      keyId,
      localeCode,
    );
  }

  @Post(':localeCode/publish')
  publish(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') keyId: string,
    @Param('localeCode') localeCode: string,
  ) {
    return this.translationService.publish(
      projectId,
      namespaceId,
      keyId,
      localeCode,
    );
  }

  @Delete(':localeCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('namespaceId') namespaceId: string,
    @Param('keyId') keyId: string,
    @Param('localeCode') localeCode: string,
  ) {
    return this.translationService.remove(
      projectId,
      namespaceId,
      keyId,
      localeCode,
    );
  }
}
