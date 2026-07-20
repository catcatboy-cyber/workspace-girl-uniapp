/**
 * 内容安全检测（微信小程序 msgSecCheck）
 *
 * 封装 cloud.openapi.security.msgSecCheck，用于检查用户上传的图片内容是否违规。
 * 调用方应在图片上传到云存储后、业务使用前调用。
 *
 * 注意：
 *   - 本模块需要 wx-server-sdk（仅微信小程序云环境可用），非 MP 环境不适用
 *   - API 自身调用失败时不阻塞用户（降级放行），避免 API 故障导致正常功能不可用
 */
let _cloud = null

function getCloud() {
  if (!_cloud) {
    try {
      const wxCloud = require('wx-server-sdk')
      wxCloud.init({ env: wxCloud.DYNAMIC_CURRENT_ENV })
      _cloud = wxCloud
    } catch (_) {
      // 非微信环境（H5 / CloudBase 独立模式）没有 wx-server-sdk
      _cloud = null
    }
  }
  return _cloud
}

/**
 * 检测图片内容是否安全
 * @param {string} fileID - 云存储 fileID，如 "cloud://xxx.xxx/path/to/image.jpg"
 * @returns {Promise<{pass: boolean}>}
 *   - pass=true: 内容安全，或检测不可用时降级放行
 *   - pass=false: 内容违规
 */
async function checkImageSafety(fileID) {
  const cloud = getCloud()
  if (!cloud) {
    // 非微信环境降级放行
    return { pass: true }
  }

  let buffer = null
  let contentType = 'image/jpeg'

  try {
    const downloadResult = await cloud.downloadFile({ fileID })
    buffer = downloadResult.fileContent
  } catch (downloadError) {
    // 下载失败（文件不存在/已删除等），放行
    console.error('contentSecCheck downloadFile error:', downloadError)
    return { pass: true }
  }

  if (!buffer || buffer.length === 0) {
    return { pass: true }
  }

  // 根据文件头推断 contentType（简单判断：PNG 头 0x89 0x50）
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    contentType = 'image/png'
  } else if (buffer[0] === 0x47 && buffer[1] === 0x49) {
    contentType = 'image/gif'
  } else if (buffer[0] === 0x52 && buffer[1] === 0x49) {
    contentType = 'image/webp'
  }

  try {
    const result = await cloud.openapi.security.msgSecCheck({
      media: {
        contentType,
        value: buffer
      }
    })

    // errCode === 0 表示内容安全
    // errCode === 87014 表示内容违规
    const pass = result.errCode === 0
    if (!pass) {
      console.warn('contentSecCheck: content flagged as risky, errCode:', result.errCode)
    }
    return { pass }
  } catch (apiError) {
    // msgSecCheck API 自身故障，降级放行（不阻塞正常用户操作）
    console.error('contentSecCheck msgSecCheck API error:', apiError)
    return { pass: true }
  }
}

module.exports = {
  checkImageSafety
}
