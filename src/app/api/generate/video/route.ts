import { NextRequest, NextResponse } from 'next/server';
import { generateVideo, queryVideoStatus } from '@/lib/scheduler';

// 创建视频（异步任务）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      apiKey, 
      prompt, 
      aspectRatio = '1:1',
      size = '720P',
      images = []
    } = body;

    // 验证参数
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: '请提供 API Key' 
      }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({ 
        success: false, 
        error: '请提供提示词' 
      }, { status: 400 });
    }

    // 验证 aspect_ratio
    const validAspectRatios = ['2:3', '3:2', '1:1'];
    if (!validAspectRatios.includes(aspectRatio)) {
      return NextResponse.json({ 
        success: false, 
        error: '无效的宽高比，支持: 2:3, 3:2, 1:1' 
      }, { status: 400 });
    }

    // 验证 size
    const validSizes = ['720P', '1080P'];
    if (!validSizes.includes(size)) {
      return NextResponse.json({ 
        success: false, 
        error: '无效的尺寸，仅支持: 720P, 1080P' 
      }, { status: 400 });
    }

    const result = await generateVideo(apiKey, {
      prompt,
      aspectRatio,
      size,
      images
    });

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || '创建视频任务失败' 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: result.taskId,
        message: '视频生成任务已创建，请使用 taskId 查询进度'
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '创建视频任务失败' 
    }, { status: 500 });
  }
}

// 查询视频生成状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const taskId = searchParams.get('taskId');

    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: '请提供 API Key' 
      }, { status: 400 });
    }

    if (!taskId) {
      return NextResponse.json({ 
        success: false, 
        error: '请提供 taskId' 
      }, { status: 400 });
    }

    const result = await queryVideoStatus(apiKey, taskId);

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || '查询失败' 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: result.taskId,
        status: result.status,
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        progress: result.progress,
        error: result.error
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '查询失败' 
    }, { status: 500 });
  }
}
