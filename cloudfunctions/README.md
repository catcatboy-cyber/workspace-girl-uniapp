# 云函数部署指南

## 方法 1：使用 CloudBase 控制台（推荐）

这是最简单的方式，适合初学者。

### 步骤 1：登录控制台

访问：https://console.cloud.tencent.com/tcb

选择你的环境：`cloud1-d8gqh3f5g49993a5a`

### 步骤 2：创建云函数

1. 点击左侧菜单"云函数"
2. 点击"新建云函数"

### 步骤 3：创建 login 云函数

**基本信息：**
- 函数名称：`login`
- 运行环境：`Node.js 16.13`
- 内存：128MB（免费额度）
- 超时时间：5秒

**函数代码：**
- 提交方式：选择"在线编辑"
- 复制 `cloudfunctions/login/index.js` 的内容粘贴进去

**依赖安装：**
在"package.json"标签页，粘贴：
```json
{
  "name": "login",
  "version": "1.0.0",
  "dependencies": {
    "@cloudbase/node-sdk": "^2.4.0"
  }
}
```

点击"完成"，等待部署完成。

### 步骤 4：创建 register 云函数

重复步骤 3，但使用：
- 函数名称：`register`
- 代码：`cloudfunctions/register/index.js`
- package.json：`cloudfunctions/register/package.json`

---

## 方法 2：使用 CLI 部署（需要登录）

如果 CLI 登录成功，可以使用命令行部署：

```bash
# 进入项目目录
cd C:\Users\catca\.openclaw\workspace-girl-uniapp

# 部署 login 云函数
cloudbase functions:deploy login --envId cloud1-d8gqh3f5g49993a5a

# 部署 register 云函数
cloudbase functions:deploy register --envId cloud1-d8gqh3f5g49993a5a
```

---

## 步骤 5：创建数据库集合

在 CloudBase 控制台：

1. 点击左侧菜单"数据库"
2. 点击"添加集合"
3. 创建集合：`users`

**索引配置：**
- 字段：`email`
- 类型：升序
- 唯一索引：是

---

## 测试云函数

部署完成后，在控制台可以测试云函数：

**测试 register：**
```json
{
  "email": "test@example.com",
  "password": "123456"
}
```

**测试 login：**
```json
{
  "email": "test@example.com",
  "password": "123456"
}
```

---

## 验证部署

部署成功后，回到 uni-app 项目：

1. 刷新浏览器：http://localhost:5173/
2. 点击"注册新账号"
3. 输入邮箱和密码
4. 点击"注册"

如果看到跳转到首页，说明部署成功！

---

## 常见问题

### Q: 云函数调用失败？
A: 检查：
1. 云函数是否部署成功
2. 环境 ID 是否正确
3. 数据库集合是否创建

### Q: 提示"该邮箱已被注册"？
A: 说明云函数工作正常，换一个邮箱即可

### Q: 提示"用户不存在"？
A: 先注册再登录

---

## 下一步

部署完成后，可以继续创建其他云函数：
- getCases - 获取案例列表
- createCase - 创建案例
- getTimeline - 获取时间线
- 等等...

参考完整计划：`../../.claude/plans/eventual-wishing-dongarra.md`
