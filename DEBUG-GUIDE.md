# 调试指南 - "Failed to fetch" 错误

## 问题现象
- 从关系主页点击"打开完整时间线"
- 跳转到新页面显示"时间线不可用，当前对象不存在或已被删除"
- 弹出错误：`TypeError: Failed to fetch`

## 可能原因

### 1. 浏览器控制台检查
打开浏览器开发者工具（F12），查看：

#### Network 标签页
- 查找失败的请求（红色）
- 点击查看详细错误信息
- 检查请求 URL 是否正确
- 检查响应状态码

#### Console 标签页
- 查看完整错误堆栈
- 查找 CORS 相关错误
- 查找认证相关错误

### 2. 常见原因排查

#### A. 登录状态失效
**症状**: 错误信息包含 "UNAUTHENTICATED" 或 "请先登录"

**解决方案**:
```javascript
// 在浏览器控制台执行
localStorage.clear()
location.reload()
// 然后重新登录
```

#### B. CloudBase 环境配置错误
**检查**: `src/utils/cloudbase.ts` 中的 ENV_ID

**当前配置**:
```typescript
export const ENV_ID = 'cloud1-d8gqh3f5g49993a5a'
```

**验证**: 访问 https://console.cloud.tencent.com/tcb 确认环境 ID 正确

#### C. CORS 跨域问题
**症状**: 错误信息包含 "CORS" 或 "Access-Control-Allow-Origin"

**解决方案**: 在腾讯云控制台配置安全域名
1. 访问 https://console.cloud.tencent.com/tcb/env/safety
2. 添加你的域名到 WEB 安全域名列表
3. 添加：`https://cloud1-d8gqh3f5g49993a5a-1422348600.tcloudbaseapp.com`

#### D. 云函数未部署或部署失败
**检查**:
```bash
cloudbase functions:list -e cloud1-d8gqh3f5g49993a5a | grep getCaseDetail
```

**预期输出**: 应该看到 getCaseDetail 且状态为 "Deployment completed"

#### E. 网络连接问题
**检查**: 
- 是否能访问 https://cloud1-d8gqh3f5g49993a5a-1422348600.tcloudbaseapp.com
- 是否能访问腾讯云 API 域名

### 3. 临时解决方案

#### 方案 A: 清除缓存重新登录
```javascript
// 浏览器控制台执行
localStorage.clear()
sessionStorage.clear()
location.href = '/pages/login/login'
```

#### 方案 B: 直接从案例详情页查看时间线
不要点击"打开完整时间线"，而是：
1. 在案例详情页向下滚动
2. 查看"关系时间线"部分
3. 或点击"查看评估历史"

### 4. 详细调试步骤

#### 步骤 1: 检查登录状态
```javascript
// 浏览器控制台执行
console.log('userId:', localStorage.getItem('userId'))
console.log('userEmail:', localStorage.getItem('userEmail'))
```

如果为空，说明未登录，需要重新登录。

#### 步骤 2: 手动测试云函数调用
```javascript
// 浏览器控制台执行
import('@/utils/cloudbase').then(({ callFunction }) => {
  callFunction({
    name: 'getCaseDetail',
    data: { caseId: 'your-case-id' } // 替换为实际的 caseId
  }).then(res => {
    console.log('Success:', res)
  }).catch(err => {
    console.error('Error:', err)
  })
})
```

#### 步骤 3: 检查 CloudBase SDK 初始化
```javascript
// 浏览器控制台执行
import('@/utils/cloudbase').then(({ auth }) => {
  auth.getLoginState().then(state => {
    console.log('Login state:', state)
  })
})
```

### 5. 查看云函数日志

```bash
# 查看最近的调用日志
cloudbase functions:log getCaseDetail -e catboy-yc4ief533dea --limit 20

# 查看错误日志
cloudbase functions:log getCaseDetail -e cloud1-d8gqh3f5g49993a5a --level error
```

### 6. 前端代码检查点

#### 检查 timeline.vue 的 loadData 函数
文件位置: `src/pages/timeline/timeline.vue:380-399`

```typescript
async function loadData() {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  if (!caseId.value) {
    showError('缺少 caseId')
    return
  }
  userId.value = uid
  loading.value = true
  try {
    caseFile.value = await getCaseDetail(uid, caseId.value) // 这里调用失败
    // ...
  } catch (e: any) {
    showError(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}
```

#### 检查 getCaseDetail API 调用
文件位置: `src/utils/api.ts:250-260`

```typescript
export async function getCaseDetail(_userId: string, caseId: string) {
  const res = await callFunction({
    name: 'getCaseDetail',
    data: { caseId }
  })
  if (!res.result?.success) {
    throw new Error(res.result?.message || '获取档案详情失败')
  }
  return normalizeCase(res.result.case)
}
```

### 7. 快速修复建议

#### 如果是登录状态问题
1. 退出登录
2. 清除浏览器缓存
3. 重新登录
4. 再次尝试访问时间线

#### 如果是 CORS 问题
需要在腾讯云控制台配置安全域名（见上文 C 部分）

#### 如果是云函数问题
重新部署云函数：
```bash
cd "C:\Users\catca\.openclaw\workspace-girl-uniapp"
echo "y" | cloudbase functions:deploy getCaseDetail -e cloud1-d8gqh3f5g49993a5a
```

### 8. 收集错误信息

如果以上方法都无法解决，请收集以下信息：

1. **浏览器控制台完整错误信息**（截图）
2. **Network 标签页的失败请求详情**（截图）
3. **当前登录状态**:
   ```javascript
   console.log({
     userId: localStorage.getItem('userId'),
     userEmail: localStorage.getItem('userEmail'),
     allKeys: Object.keys(localStorage)
   })
   ```
4. **访问的 URL** 和 **caseId**
5. **操作步骤**（从哪个页面点击了什么按钮）

---

## 临时绕过方案

如果时间线页面无法访问，可以：

1. **在案例详情页查看时间线**
   - 案例详情页已经包含了时间线数据
   - 向下滚动查看"关系时间线"部分

2. **直接查看评估历史**
   - 点击"查看评估历史"按钮
   - 可以看到所有评估记录和趋势图

3. **添加新事件**
   - 在案例详情页可以直接添加新的时间线事件
   - 不需要跳转到时间线页面

---

## 联系开发者

如果问题仍未解决，请提供上述收集的错误信息。
