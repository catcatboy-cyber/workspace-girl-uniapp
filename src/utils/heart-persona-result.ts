import { getSelfProfile, shouldCompleteSelfProfile } from './api'

export async function enterHomeFromHeartPersonaResult() {
  let response: any
  try {
    response = await getSelfProfile()
  } catch (error: any) {
    uni.showToast({ title: error?.message || '暂时无法读取画像，请稍后重试', icon: 'none' })
    return false
  }
  if (!response?.success) {
    uni.showToast({ title: response?.message || '暂时无法读取画像，请稍后重试', icon: 'none' })
    return false
  }
  if (shouldCompleteSelfProfile(response)) {
    uni.navigateTo({ url: '/pages/self-profile/self-profile?mode=onboarding' })
    return true
  }
  uni.switchTab({ url: '/pages/index/index' })
  return true
}
