// 图床上传工具 - 将本地图片转换为可访问的URL
const IMAGE_BED_API = 'https://telegraph-image-92x.pages.dev/api/upload';

/**
 * 将 base64 图片上传到图床，返回可访问的URL
 * @param base64Image - base64 编码的图片数据（不包含 data:image/xxx;base64, 前缀）
 * @param mimeType - 图片的 MIME 类型
 * @returns 可访问的 URL
 */
export async function uploadToImageBed(
  base64Image: string,
  mimeType: string = 'image/png'
): Promise<string> {
  try {
    // 构造完整的 base64 数据
    const fullBase64 = `data:${mimeType};base64,${base64Image}`;
    
    // 转换为 Blob
    const byteCharacters = atob(base64Image);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    // 创建 FormData
    const formData = new FormData();
    formData.append('file', blob, 'image.png');
    
    // 上传到图床
    const response = await fetch(IMAGE_BED_API, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`上传失败: ${response.status}`);
    }
    
    const result = await response.json();
    
    // 检查返回的数据结构
    if (result.success && result.data && result.data.url) {
      return result.data.url;
    }
    
    // 如果是其他格式的返回
    if (result.url) {
      return result.url;
    }
    
    throw new Error('上传成功但未获取到URL');
  } catch (error) {
    console.error('图床上传失败:', error);
    throw error;
  }
}

/**
 * 批量上传图片到图床
 * @param images - 图片数组，每个元素包含 base64 数据和 MIME 类型
 * @returns 上传后的 URL 数组
 */
export async function uploadImagesToBed(
  images: Array<{ base64: string; mimeType: string }>
): Promise<string[]> {
  const results: string[] = [];
  
  for (const img of images) {
    try {
      const url = await uploadToImageBed(img.base64, img.mimeType);
      results.push(url);
    } catch (error) {
      console.error('单张图片上传失败:', error);
      // 如果上传失败，返回空字符串
      results.push('');
    }
  }
  
  return results;
}
