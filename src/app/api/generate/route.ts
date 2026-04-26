import { NextRequest, NextResponse } from 'next/server';
import { generateImage, getUserKeyBalance, GenerateImageOptions } from '@/lib/scheduler';
import { callLogsDb, userKeysDb } from '@/lib/db';

// 用户查询余额或日志 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const action = searchParams.get('action'); // 'balance' 或 'logs'

    // 如果提供了 API Key
    if (apiKey) {
      const keyInfo = await userKeysDb.getByKeyValue(apiKey);
      if (!keyInfo || !keyInfo.is_active) {
        return NextResponse.json({ 
          success: false, 
          error: '无效的 API Key 或已禁用' 
        }, { status: 400 });
      }

      // 获取日志
      if (action === 'logs') {
        const limit = parseInt(searchParams.get('limit') || '20');
        const logs = await callLogsDb.getByUserKeyId(keyInfo.id, limit);
        return NextResponse.json({
          success: true,
          data: logs.map(log => ({
            model: log.model,
            prompt: log.prompt,
            success: log.success,
            cost: log.cost,
            created_at: log.created_at
          }))
        });
      }

      // 默认返回余额信息
      const balanceInfo = await getUserKeyBalance(apiKey);
      if (!balanceInfo) {
        return NextResponse.json({ 
          success: false, 
          error: '无效的 API Key 或已禁用' 
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        data: {
          name: balanceInfo.name,
          balance_limit: balanceInfo.balance_limit,
          used_balance: balanceInfo.used_balance,
          remaining_balance: balanceInfo.remaining_balance,
          usage_count: balanceInfo.usage_count,
          is_active: balanceInfo.is_active
        }
      });
    }

    // 否则返回系统状态（公开信息）- 暂不实现
    return NextResponse.json({
      success: true,
      data: {
        message: '请提供 apiKey 参数查询余额，或添加 action=logs 获取调用日志'
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: '获取状态失败' 
    }, { status: 500 });
  }
}

// 用户调用生成图片 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      apiKey, 
      prompt, 
      model = 'gemini',
      // Gemini 参数
      aspectRatio = '1:1', 
      imageSize = '2K',
      referenceImage,
      referenceImages,
      // GPT-image-2 参数
      size = '1024x1024',
      n = 1,
      imageUrls
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

    // 验证模型
    if (model !== 'gemini' && model !== 'gpt-image-2') {
      return NextResponse.json({ 
        success: false, 
        error: '无效的模型，支持 gemini 或 gpt-image-2' 
      }, { status: 400 });
    }

    const options: GenerateImageOptions = {
      prompt,
      model,
      // Gemini 参数
      aspectRatio,
      imageSize,
      referenceImage,
      referenceImages,
      // GPT-image-2 参数
      size,
      n,
      imageUrls
    };

    const result = await generateImage(apiKey, options);

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || '生成失败' 
      }, { status: 400 });
    }

    // 获取第一张图片（支持多张但前端只显示一张）
    const firstImage = result.images?.[0];

    return NextResponse.json({
      success: true,
      data: {
        image: firstImage?.data,
        mimeType: firstImage?.mimeType,
        cost: result.cost,
        model: result.model
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '生成失败' 
    }, { status: 500 });
  }
}
