import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getReportBuffer, createWrappedFetch } from 'coze-coding-dev-sdk';

// 使用 Supabase Storage 上传图片
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { base64, mimeType } = body;

    if (!base64) {
      return NextResponse.json({ 
        success: false, 
        error: '请提供图片数据' 
      }, { status: 400 });
    }

    // 转换 base64 为 Buffer
    const buffer = Buffer.from(base64, 'base64');
    
    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = mimeType?.includes('jpeg') || mimeType?.includes('jpg') ? 'jpg' : 
                mimeType?.includes('png') ? 'png' : 
                mimeType?.includes('gif') ? 'gif' : 'jpg';
    const fileName = `video-ref-${timestamp}-${randomStr}.${ext}`;
    
    // 使用 Supabase Storage 上传
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.storage
      .from('images')  // 存储桶名称
      .upload(fileName, buffer, {
        contentType: mimeType || 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Supabase Storage 上传失败:', error);
      return NextResponse.json({ 
        success: false, 
        error: `上传失败: ${error.message}` 
      }, { status: 500 });
    }

    // 获取公开访问的 URL
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return NextResponse.json({ 
        success: false, 
        error: '获取 URL 失败' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl
    });

  } catch (error) {
    console.error('图床上传失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '上传失败' 
    }, { status: 500 });
  }
}
