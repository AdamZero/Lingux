import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { AuthGuard } from '@nestjs/passport';
import '../auth/types/auth.types'; // 引入类型扩展

@Controller('workspace')
@UseGuards(AuthGuard('jwt'))
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('stats')
  async getStats(@Query('projectId') projectId: string, @Request() req: any) {
    const userId = req.user.id;
    return this.workspaceService.getStats(projectId, userId);
  }

  @Get('tasks')
  async getTasks(
    @Query('projectId') projectId: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.workspaceService.getTasks(
      projectId,
      userId,
      Number(page),
      Number(pageSize),
    );
  }
}
