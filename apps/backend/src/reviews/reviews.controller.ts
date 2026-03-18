import { Controller, Get, Post, Query, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('reviews')
@UseGuards(AuthGuard('jwt'))
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async getReviewTasks(
    @Query('projectId') projectId: string,
    @Query('status') status?: 'pending' | 'completed',
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.reviewsService.getReviewTasks(projectId, status, Number(page), Number(pageSize));
  }

  @Post(':id/approve')
  async approveReview(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId;
    return this.reviewsService.approveReview(id, userId);
  }

  @Post(':id/reject')
  async rejectReview(
    @Param('id') id: string,
    @Request() req: any,
    @Body('reason') reason: string,
    @Body('suggestion') suggestion?: string,
  ) {
    const userId = req.user.userId;
    return this.reviewsService.rejectReview(id, userId, reason, suggestion);
  }
}
