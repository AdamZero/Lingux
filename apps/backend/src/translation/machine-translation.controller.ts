import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MachineTranslationService } from './services/machine-translation.service';
import { GetTranslationJobsDto } from './dto/get-translation-jobs.dto';
import {
  IsString,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsObject,
  IsNotEmpty,
  IsArray,
  IsIn,
} from 'class-validator';

class TranslateRequestDto {
  @IsString()
  @IsOptional()
  providerId?: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  sourceLanguage?: string;

  @IsString()
  @IsNotEmpty()
  targetLanguage: string;

  @IsIn(['text', 'html'])
  @IsOptional()
  format?: 'text' | 'html';
}

class BatchTranslateRequestDto {
  @IsString()
  @IsOptional()
  providerId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  texts: string[];

  @IsString()
  @IsOptional()
  sourceLanguage?: string;

  @IsString()
  @IsNotEmpty()
  targetLanguage: string;

  @IsIn(['text', 'html'])
  @IsOptional()
  format?: 'text' | 'html';
}

class CreateTranslationJobDto {
  @IsString()
  @IsOptional()
  providerId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  texts: string[];

  @IsString()
  @IsNotEmpty()
  sourceLanguage: string;

  @IsString()
  @IsNotEmpty()
  targetLanguage: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}

class CreateProviderDto {
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsString()
  baseUrl: string;

  @IsString()
  apiKey: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsNumber()
  @IsOptional()
  rateLimitPerMin?: number;

  @IsNumber()
  @IsOptional()
  maxCharsPerReq?: number;

  @IsNumber()
  @IsOptional()
  maxTextsPerReq?: number;

  @IsNumber()
  @IsOptional()
  timeoutMs?: number;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;
}

/**
 * 机器翻译控制器
 * 提供翻译供应商管理和机器翻译API
 */
@Controller('translation-providers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MachineTranslationController {
  constructor(
    private readonly machineTranslationService: MachineTranslationService,
  ) {}

  /**
   * 获取所有翻译供应商
   */
  @Get()
  async getProviders() {
    return this.machineTranslationService.getProviders();
  }

  /**
   * 创建翻译供应商
   */
  @Post()
  @Roles('ADMIN')
  async createProvider(@Body() dto: CreateProviderDto) {
    return this.machineTranslationService.createProvider(dto);
  }

  /**
   * 获取默认供应商
   */
  @Get('default')
  async getDefaultProvider() {
    const provider = await this.machineTranslationService.getDefaultProvider();
    if (!provider) {
      return { message: 'No default provider configured' };
    }
    return provider;
  }

  /**
   * 获取供应商详情
   */
  @Get(':id')
  async getProviderInfo(@Param('id') providerId: string) {
    return this.machineTranslationService.getProviderInfo(providerId);
  }

  /**
   * 检查供应商健康状态
   */
  @Get(':id/health')
  async checkProviderHealth(@Param('id') providerId: string) {
    const isHealthy =
      await this.machineTranslationService.checkProviderHealth(providerId);
    return {
      providerId,
      status: isHealthy ? 'healthy' : 'unhealthy',
    };
  }

  /**
   * 删除翻译供应商
   */
  @Delete(':id')
  @Roles('ADMIN')
  async deleteProvider(@Param('id') providerId: string) {
    await this.machineTranslationService.deleteProvider(providerId);
    return { message: 'Provider deleted successfully' };
  }

  /**
   * 更新翻译供应商
   */
  @Put(':id')
  @Roles('ADMIN')
  async updateProvider(
    @Param('id') providerId: string,
    @Body() dto: Partial<CreateProviderDto>,
  ) {
    return this.machineTranslationService.updateProvider(providerId, dto);
  }

  /**
   * 设置默认供应商
   */
  @Put(':id/default')
  @Roles('ADMIN')
  async setDefaultProvider(@Param('id') providerId: string) {
    await this.machineTranslationService.setDefaultProvider(providerId);
    return { message: 'Default provider set successfully' };
  }

  /**
   * 执行单个文本翻译
   */
  @Post('translate')
  async translate(@Body() dto: TranslateRequestDto) {
    // 如果没有指定供应商，使用默认供应商
    let providerId = dto.providerId;
    if (!providerId) {
      const defaultProvider =
        await this.machineTranslationService.getDefaultProvider();
      if (!defaultProvider) {
        throw new Error('No translation provider configured');
      }
      providerId = defaultProvider.id;
    }

    const result = await this.machineTranslationService.translate(
      providerId,
      dto.text,
      {
        sourceLanguage: dto.sourceLanguage,
        targetLanguage: dto.targetLanguage,
        format: dto.format || 'text',
      },
    );

    return {
      providerId,
      sourceText: dto.text,
      ...result,
    };
  }

  /**
   * 执行批量翻译
   */
  @Post('translate-batch')
  async translateBatch(@Body() dto: BatchTranslateRequestDto) {
    // 如果没有指定供应商，使用默认供应商
    let providerId = dto.providerId;
    if (!providerId) {
      const defaultProvider =
        await this.machineTranslationService.getDefaultProvider();
      if (!defaultProvider) {
        throw new Error('No translation provider configured');
      }
      providerId = defaultProvider.id;
    }

    const result = await this.machineTranslationService.translateBatch(
      providerId,
      dto.texts,
      {
        sourceLanguage: dto.sourceLanguage,
        targetLanguage: dto.targetLanguage,
        format: dto.format || 'text',
      },
    );

    return {
      providerId,
      sourceTexts: dto.texts,
      ...result,
    };
  }

  /**
   * 获取翻译任务列表
   */
  @Get('jobs')
  async getTranslationJobs(@Query() dto: GetTranslationJobsDto) {
    return this.machineTranslationService.getTranslationJobs(dto);
  }

  /**
   * 获取翻译任务详情
   */
  @Get('jobs/:id')
  async getTranslationJobDetail(@Param('id') id: string) {
    return this.machineTranslationService.getTranslationJobDetail(id);
  }

  /**
   * 获取月度统计
   */
  @Get('monthly-stats')
  async getMonthlyStats(
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    return this.machineTranslationService.getMonthlyStats(year, month);
  }

  /**
   * 创建翻译任务（异步）
   */
  @Post('jobs')
  async createTranslationJob(@Body() dto: CreateTranslationJobDto) {
    // 如果没有指定供应商，使用默认供应商
    let providerId = dto.providerId;
    if (!providerId) {
      const defaultProvider =
        await this.machineTranslationService.getDefaultProvider();
      if (!defaultProvider) {
        throw new Error('No translation provider configured');
      }
      providerId = defaultProvider.id;
    }

    const jobId = await this.machineTranslationService.createTranslationJob(
      providerId,
      dto.texts,
      dto.sourceLanguage,
      dto.targetLanguage,
      dto.projectId,
    );

    return {
      jobId,
      status: 'PENDING',
      message: 'Translation job created successfully',
    };
  }

  /**
   * 获取翻译任务状态
   */
  @Get('jobs/:id')
  async getTranslationJob(@Param('id') jobId: string) {
    return this.machineTranslationService.getTranslationJob(jobId);
  }

  /**
   * 获取翻译成本统计
   */
  @Get('costs/statistics')
  @Roles('ADMIN')
  async getCostStatistics(
    @Query('providerId') providerId?: string,
    @Query('billingPeriod') billingPeriod?: string,
  ) {
    return this.machineTranslationService.getCostStatistics(
      providerId,
      billingPeriod,
    );
  }
}
