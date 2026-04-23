# 部署与测试指南

## 一、部署前检查

### 代码检查
- [x] debugUsers 云函数已删除（当前云函数数量：17）
- [x] createTimeline 事务已恢复
- [x] assessments 顺序约定已统一
- [ ] 本地代码编译通过
- [ ] 云函数依赖已安装

### 环境配置检查
```bash
# 1. 检查 CloudBase 环境 ID
grep "ENV_ID" src/utils/cloudbase.ts
# 应显示: export const ENV_ID = 'catboy-d0gg4yc4ief533dea'

# 2. 检查云函数配置
cat cloudbaserc.json
```

---

## 二、部署步骤

### 1. 安装云函数依赖
```bash
cd cloudfunctions

# 为每个云函数安装依赖（如果有 package.json）
for dir in */; do
  if [ -f "$dir/package.json" ]; then
    echo "Installing dependencies for $dir"
    cd "$dir"
    npm install
    cd ..
  fi
done
```

### 2. 部署云函数
```bash
# 登录腾讯云
cloudbase login

# 部署所有云函数
cloudbase functions:deploy --all -e catboy-d0gg4yc4ief533dea

# 或单独部署关键云函数
cloudbase functions:deploy createTimeline -e catboy-d0gg4yc4ief533dea
cloudbase functions:deploy getCaseDetail -e catboy-d0gg4yc4ief533dea
cloudbase functions:deploy getCases -e catboy-d0gg4yc4ief533dea
```

### 3. 验证部署
```bash
# 查看云函数列表
cloudbase functions:list -e catboy-d0gg4yc4ief533dea

# 确认 debugUsers 不在列表中
```

### 4. 部署前端（H5）
```bash
# 构建 H5 版本
npm run build:h5

# 部署到静态托管
cloudbase hosting:deploy dist/build/h5 -e catboy-d0gg4yc4ief533dea
```

---

## 三、功能测试清单

### 3.1 基础功能测试

#### 用户认证
- [ ] 注册新用户（测试邮箱 + 密码）
- [ ] 登录已有用户
- [ ] 登出后重新登录
- [ ] 错误密码提示

#### 案例管理
- [ ] 创建新案例（填写完整表单）
- [ ] 查看案例列表
- [ ] 查看案例详情
- [ ] 编辑案例画像
- [ ] 删除案例

#### 时间线功能
- [ ] 添加时间线事件
- [ ] 查看时间线列表
- [ ] 验证系统自动生成评估记录
- [ ] 验证系统自动生成趋势记录

#### 评估功能
- [ ] 手动重评
- [ ] 查看评估历史
- [ ] 验证趋势对比正确
- [ ] 验证趋势图显示正确

#### AI 功能
- [ ] 配置 AI 设置
- [ ] 测试 AI 连接
- [ ] 添加事件触发 AI 重算
- [ ] 验证 AI 生成的评估结果

---

### 3.2 关键修复验证

#### ✅ P0: debugUsers 已删除
**测试步骤**:
```bash
# 尝试调用 debugUsers 云函数（应该失败）
curl -X POST https://your-env.service.tcloudbase.com/debugUsers
# 预期结果: 404 或函数不存在错误
```

#### ✅ P1: createTimeline 事务
**测试步骤**:
1. 创建案例
2. 添加时间线事件
3. 检查数据库：
   - timeline_records 表应有新记录
   - assessments 表应有新评估
   - timeline_records 表应有系统趋势记录
   - cases 表的 latestResultId 应更新

**模拟失败场景**:
- 在 createTimeline 云函数中人为抛出异常
- 验证所有写入都被回滚

#### ✅ P1: assessments 顺序
**测试步骤**:
1. 创建案例并初评
2. 重评 2-3 次
3. 查看案例详情页：
   - 趋势对比应显示"最近两次"的对比
   - 趋势图应按时间正序显示
4. 查看评估历史页：
   - 最新评估应在最上面
   - 编号应正确（第 N 次评估）

---

### 3.3 并发测试

#### 并发创建时间线
```javascript
// 在浏览器控制台执行
const caseId = 'your-case-id'
const promises = []
for (let i = 0; i < 5; i++) {
  promises.push(
    fetch('/api/createTimeline', {
      method: 'POST',
      body: JSON.stringify({
        caseId,
        description: `并发测试事件 ${i}`,
        occurrenceAt: new Date().toISOString()
      })
    })
  )
}
await Promise.all(promises)
// 验证: 5 条记录都成功创建，且 latestResultId 正确
```

---

### 3.4 边界测试

#### 空数据测试
- [ ] 创建案例后立即查看详情（无评估历史）
- [ ] 删除所有时间线记录后查看
- [ ] 未配置 AI 时添加事件

#### 异常数据测试
- [ ] 超长文本输入
- [ ] 特殊字符输入
- [ ] 无效日期输入
- [ ] 并发修改同一案例

---

## 四、性能监控

### 关键指标
1. **云函数响应时间**:
   - createTimeline: < 3 秒（含 AI 调用）
   - getCaseDetail: < 500ms
   - getCases: < 1 秒

2. **错误率**:
   - 目标: < 1%
   - 重点监控 createTimeline 事务失败率

3. **数据一致性**:
   - 定期检查孤儿记录（timeline_records 无对应 assessment）
   - 检查 latestResultId 是否指向有效评估

### 监控方法
```bash
# 查看云函数日志
cloudbase functions:log createTimeline -e catboy-d0gg4yc4ief533dea --limit 100

# 查看错误日志
cloudbase functions:log createTimeline -e catboy-d0gg4yc4ief533dea --level error
```

---

## 五、灰度发布策略

### 阶段 1: 内部测试（1-2 天）
- 测试账号: 2-3 个
- 测试内容: 完整功能测试清单
- 通过标准: 所有核心功能正常，无 P0/P1 bug

### 阶段 2: 小范围灰度（3-5 天）
- 用户数: 10-20 人
- 监控指标: 错误率、响应时间、用户反馈
- 回滚条件: 错误率 > 5% 或出现数据丢失

### 阶段 3: 全量发布
- 前提: 阶段 2 无重大问题
- 持续监控 7 天

---

## 六、回滚方案

### 快速回滚
```bash
# 1. 回滚云函数到上一版本
cloudbase functions:deploy createTimeline -e catboy-d0gg4yc4ief533dea --code-secret <previous-version>

# 2. 回滚前端
cloudbase hosting:deploy <previous-build> -e catboy-d0gg4yc4ief533dea
```

### 数据修复
如果发现数据不一致：
```javascript
// 查找孤儿 timeline_records（无对应 assessment）
db.collection('timeline_records')
  .where({ type: 'positive' }) // 用户事件
  .get()
  .then(records => {
    // 检查每条记录对应的 assessment 是否存在
  })
```

---

## 七、常见问题

### Q1: 事务超时怎么办？
A: 检查 AI 调用是否在事务外。当前设计已将 AI 调用移到事务外，事务仅包含数据库写入。

### Q2: assessments 顺序混乱？
A: 确认后端返回的是 `orderBy('createdAt', 'asc')`，前端使用 `assessments[length-1]` 获取最新。

### Q3: debugUsers 仍然可访问？
A: 检查是否重新部署了云函数。删除本地目录后需要重新部署才能生效。

---

## 八、联系方式

如遇到问题，请记录：
1. 操作步骤
2. 错误信息（截图或日志）
3. 用户 ID 和 case ID
4. 时间戳

然后提交 issue 或联系开发者。
