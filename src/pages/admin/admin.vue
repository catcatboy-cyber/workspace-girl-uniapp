<template>
  <view class="admin-page v2-mode">
    <view class="admin-layout">
      <view class="admin-sidebar">
        <text class="sidebar-brand">后台管理</text>
        <view class="sidebar-group">
          <text class="sidebar-group-title">核心管理</text>
          <view :class="['sidebar-item', activeTab === 'users' ? 'active' : '']" @click="activeTab = 'users'">👤 用户管理</view>
        </view>
        <view class="sidebar-group">
          <text class="sidebar-group-title">{{ aiLabel() }} 配置</text>
          <view :class="['sidebar-item', activeTab === 'ai' ? 'active' : '']" @click="activeTab = 'ai'">🤖 AI 设置</view>
        </view>
        <view class="sidebar-group">
          <text class="sidebar-group-title">计费管理</text>
          <view :class="['sidebar-item', activeTab === 'billing' ? 'active' : '']" @click="activeTab = 'billing'">🪙 Credits 额度</view>
          <view :class="['sidebar-item', activeTab === 'subscription' ? 'active' : '']" @click="activeTab = 'subscription'">📦 订阅配置</view>
        </view>
        <view class="sidebar-group">
          <text class="sidebar-group-title">数据中心</text>
          <view :class="['sidebar-item', activeTab === 'tokenUsers' ? 'active' : '']" @click="activeTab = 'tokenUsers'">📈 Credits 消耗</view>
          <view :class="['sidebar-item', activeTab === 'orders' ? 'active' : '']" @click="activeTab = 'orders'">📋 订单管理</view>
          <view :class="['sidebar-item', activeTab === 'loginLogs' ? 'active' : '']" @click="activeTab = 'loginLogs'">🔐 登录日志</view>
          <view :class="['sidebar-item', activeTab === 'referralClaims' ? 'active' : '']" @click="activeTab = 'referralClaims'">💎 邀请奖励</view>
        </view>
        <view class="sidebar-group">
          <text class="sidebar-group-title">运营工具</text>
          <view :class="['sidebar-item', activeTab === 'feedback' ? 'active' : '']" @click="activeTab = 'feedback'">💬 反馈管理</view>
          <view :class="['sidebar-item', activeTab === 'customPet' ? 'active' : '']" @click="activeTab = 'customPet'">🐾 宠物需求</view>
        </view>
      </view>
      <view class="admin-main">
      <view class="topbar">
        <view>
          <text class="eyebrow">Admin Console</text>
          <text class="title">后台管理</text>
          <text class="current-user-line">当前登录用户：{{ currentUserDisplay }} · {{ currentUserRole }}</text>
        </view>
        <view class="top-actions">
          <view class="current-user-card">
            <text class="current-user-label">当前用户 ID</text>
            <text class="current-user-id mono">{{ effectiveCurrentUserId || '-' }}</text>
          </view>
          <button class="ghost-btn" @click="refresh">刷新</button>
          <button class="ghost-btn wide-btn" @click="goAdminLogin">管理员登录</button>
          <button class="ghost-btn danger-btn" @click="handleLogout">退出登录</button>
        </view>
      </view>

      <view v-if="errorMessage" class="alert">
        <text>{{ errorMessage }}</text>
      </view>

      <view class="stats-grid">
        <view class="stat-card">
          <text class="stat-label">用户</text>
          <text class="stat-value">{{ stats.userCount }}</text>
        </view>
        <view class="stat-card">
          <text class="stat-label">Crushes</text>
          <text class="stat-value">{{ stats.caseCount }}</text>
        </view>
        <view class="stat-card">
          <text class="stat-label">{{ aiLabel() }} 状态</text>
          <text class="stat-value">{{ stats.aiEnabled ? '已启用' : '未启用' }}</text>
        </view>
      </view>

      <view v-if="activeTab === 'users'" class="content-grid">
        <view class="panel">
          <view class="panel-head">
            <text class="panel-title">登录用户</text>
            <text class="panel-meta">{{ users.length }} 个账号</text>
          </view>
          <view class="table">
            <view class="table-row table-header">
              <text>账号</text>
              <text>方式</text>
              <text>套餐</text>
              <text>Crush</text>
              <text>权限</text>
            </view>
            <view
              v-for="user in users"
              :key="user.id"
              :class="['table-row', selectedUserId === user.id ? 'selected' : '']"
              @click="selectUser(user.id)"
            >
              <text class="mono">{{ user.email || user.phone || user.id }}</text>
              <text>{{ user.loginType || 'email' }}</text>
              <text :class="['plan-tag', planTagClass(user)]">{{ user.planLabel || '免费版' }}</text>
              <text>{{ user.caseCount }}</text>
              <text>{{ user.id === effectiveCurrentUserId ? '当前' : (user.isAdmin ? '管理员' : '用户') }}</text>
            </view>
          </view>
        </view>

        <view class="panel">
          <view class="panel-head">
            <text class="panel-title">用户详情</text>
            <text class="panel-meta">{{ selectedUser?.email || selectedUser?.phone || '未选择' }}</text>
          </view>
          <view v-if="detailLoading" class="empty">正在读取用户数据...</view>
          <view v-else-if="!selectedDetail" class="empty">选择左侧用户查看 Crushes 和记录概况。</view>
          <view v-else>
            <view class="detail-line">
              <text class="detail-label">用户 ID</text>
              <text class="detail-value mono">{{ selectedDetail.user.id }}</text>
            </view>
            <view class="detail-line">
              <text class="detail-label">注册时间</text>
              <text class="detail-value">{{ formatDate(selectedDetail.user.createdAt) }}</text>
            </view>
            <view v-if="selectedDetail.user.landingChannel || selectedDetail.user.landingScene" class="detail-line">
              <text class="detail-label">来源</text>
              <text class="detail-value">{{ [selectedDetail.user.landingChannel, selectedDetail.user.landingScene, selectedDetail.user.landingRef].filter(Boolean).join(' · ') || '-' }}</text>
            </view>
            <view v-if="selectedDetail.user.landingShareId" class="detail-line">
              <text class="detail-label">分享ID</text>
              <text class="detail-value mono" style="font-size:18rpx;">{{ selectedDetail.user.landingShareId }}</text>
            </view>
            <view v-if="selectedDetail.user.landingInviteCode" class="detail-line">
              <text class="detail-label">邀请码</text>
              <text class="detail-value">{{ selectedDetail.user.landingInviteCode }}</text>
            </view>

            <view class="settings-section" style="margin-top:16px;">
              <view class="section-head" style="margin-bottom:12px;">
                <text class="section-title">编辑用户信息</text>
              </view>
              <view class="form-grid">
                <view class="field">
                  <text>套餐</text>
                  <picker :range="planOptions" :value="planOptions.indexOf(userEditForm.plan)" @change="onPlanChange">
                    <view class="picker-like">{{ userEditForm.plan || 'free' }} · {{ planLabelText(userEditForm.plan) }}</view>
                  </picker>
                </view>
                <view class="field">
                  <text>管理员权限</text>
                  <switch :checked="userEditForm.isAdmin" @change="userEditForm.isAdmin = $event.detail.value" />
                </view>
                <view class="field">
                  <text>试用到期</text>
                  <picker mode="date" :value="userEditForm.trialEndsAt" @change="onTrialDateChange">
                    <view class="picker-like">{{ userEditForm.trialEndsAt || '留空 = 无试用期' }}</view>
                  </picker>
                </view>
                <view class="field">
                  <text>套餐到期</text>
                  <picker mode="date" :value="userEditForm.planExpiresAt" @change="onPlanDateChange">
                    <view class="picker-like">{{ userEditForm.planExpiresAt || '留空 = 无期限' }}</view>
                  </picker>
                </view>
                <view class="field">
                  <text>加油包 Credits</text>
                  <input v-model.number="userEditForm.extraTokens" type="number" placeholder="0" />
                </view>
                <view class="field">
                  <text>本月已用 Credits</text>
                  <input v-model.number="userEditForm.monthlyTokensUsed" type="number" placeholder="0" />
                </view>
                <view class="field">
                  <text>邀请码</text>
                  <input v-model="userEditForm.inviteCode" placeholder="6位邀请码" />
                </view>
              </view>
              <button class="primary-btn" :disabled="userEditSaving" @click="saveUserEdit" style="margin-top:12px;width:100%;">{{ userEditSaving ? '保存中...' : '保存用户信息' }}</button>
              <text v-if="userEditMsg" :class="userEditOk ? 'save-message' : 'test-result fail'" style="margin-top:8px;display:block;">{{ userEditMsg }}</text>
              <button class="danger-btn" :disabled="userEditSaving || deleteUserLoading" @click="confirmDeleteUser" style="margin-top:16px;width:100%;">{{ deleteUserLoading ? '删除中...' : '删除该用户及全部数据' }}</button>
            </view>

            <view class="case-list" style="margin-top:16px;">
              <view v-for="item in selectedDetail.cases" :key="item.id" class="case-item">
                <view>
                  <text class="case-name">{{ item.name }}</text>
                  <text class="case-meta">{{ formatDate(item.updatedAt || item.createdAt) }}</text>
                </view>
                <view class="case-counts">
                  <text>{{ item.assessmentCount }} 次分析</text>
                  <text>{{ item.timelineCount }} 条记录</text>
                </view>
              </view>
              <view v-if="selectedDetail.cases.length === 0" class="empty">暂无 Crush。</view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="activeTab === 'ai'" class="panel">
        <view class="panel-head">
          <view>
            <text class="panel-title">全局 AI 设置</text>
            <text class="panel-meta">支持多模型配置，默认模型会被时间线 {{ aiLabel() }} 分析优先使用。</text>
          </view>
          <button class="ghost-btn wide-btn" @click="addModel">添加模型</button>
        </view>

        <view class="switch-row">
          <view>
            <text class="field-title">启用 AI 事件分析</text>
            <text class="field-desc">关闭后前台会回退到规则分析。</text>
          </view>
          <switch :checked="aiForm.aiEnabled" @change="onAIEnabledChange" />
        </view>

        <view class="switch-row">
          <view>
            <text class="field-title">{{ aiLabel() }} 失败时回退规则</text>
            <text class="field-desc">建议保持开启，避免用户保存记录失败。</text>
          </view>
          <switch :checked="aiForm.aiFallbackToRules" @change="onFallbackChange" />
        </view>

        <view v-for="(model, index) in models" :key="model.id" class="model-card">
          <view class="model-head">
            <view>
              <text class="model-title">{{ model.name || model.model || '未命名模型' }}</text>
              <text class="model-subtitle">{{ model.provider }} / {{ model.model || '未填写模型名' }}</text>
            </view>
            <view class="model-actions">
              <button
                :class="['small-btn', defaultModelId === model.id ? 'active' : '']"
                @click="setDefaultModel(model.id)"
              >
                {{ defaultModelId === model.id ? '默认' : '设为默认' }}
              </button>
              <button class="small-btn" :disabled="testingModelId === model.id" @click="testModel(model)">
                {{ testingModelId === model.id ? '测试中' : '测试' }}
              </button>
              <button v-if="models.length > 1" class="small-btn danger" @click="removeModel(index)">删除</button>
            </view>
          </view>

          <view class="form-grid">
            <view class="field">
              <text>显示名称</text>
              <input v-model="model.name" placeholder="例如：DeepSeek" />
            </view>
            <view class="field">
              <text>供应商</text>
              <input v-model="model.provider" placeholder="deepseek" />
            </view>
            <view class="field wide">
              <text>Base URL</text>
              <input v-model="model.baseUrl" placeholder="https://api.deepseek.com/v1" />
            </view>
            <view class="field">
              <text>模型名</text>
              <input v-model="model.model" placeholder="deepseek-chat" />
            </view>
            <view class="field">
              <text>API Key</text>
              <input v-model="model.apiKey" password placeholder="留空则沿用已保存密钥" />
            </view>
            <view class="field">
              <text>总额度（tokens，0=不限）</text>
              <input v-model.number="model.quota" type="number" placeholder="例如 5000000" />
            </view>
            <view v-if="model.tokensUsed > 0" class="field">
              <text>已消耗</text>
              <text class="quota-used-text">{{ (model.tokensUsed / 1000000).toFixed(2) }}M tokens</text>
            </view>
          </view>

          <view class="model-foot">
            <text v-if="model.hasApiKey && !model.apiKey" class="hint">已保存密钥；留空保存时会继续沿用旧密钥。</text>
            <text v-if="model.testMessage" :class="['test-result', model.testOk ? 'pass' : 'fail']">{{ model.testMessage }}</text>
          </view>
        </view>

        <!-- 小咪帮你说提示词配置 -->
        <view class="settings-section prompt-section">
          <view class="section-head">
            <text class="section-title">小咪帮你说 · 提示词</text>
            <text class="section-desc">配置撩一下和帮你说发给 AI 的 system prompt。留空则使用默认值。</text>
          </view>

          <view class="pet-speak-tabs">
            <view v-for="psk in petSpeakModuleKeys" :key="psk.key"
              :class="['pet-speak-tab', petSpeakActiveKey === psk.key ? 'active' : '']"
              @click="switchPetSpeakKey(psk.key)">
              {{ psk.label }}
            </view>
          </view>

          <view class="form-grid">
            <view class="field wide">
              <text>System Prompt</text>
              <textarea v-model="petSpeakForm.systemPrompt" class="textarea large mono" :maxlength="-1"
                :placeholder="petSpeakDefaults[petSpeakActiveKey]?.systemPrompt || ''" />
            </view>
            <view class="field-row">
              <view class="field">
                <text>Temperature</text>
                <input v-model.number="petSpeakForm.temperature" type="number" step="0.05" min="0" max="2"
                  :placeholder="String(petSpeakDefaults[petSpeakActiveKey]?.temperature ?? 0.8)" />
              </view>
              <view class="field">
                <text>Max Credits</text>
                <input v-model.number="petSpeakForm.maxTokens" type="number" step="50" min="50" max="4000"
                  :placeholder="String(petSpeakDefaults[petSpeakActiveKey]?.maxTokens ?? 400)" />
              </view>
            </view>
          </view>

          <button class="ghost-btn" @click="restorePetSpeakDefault">恢复模块默认值</button>
        </view>

        <view class="settings-section prompt-section">
          <view class="section-head">
            <text class="section-title">运行参数</text>
            <text class="section-desc">控制上下文数量、输出长度和温度，影响速度与稳定性。</text>
          </view>
          <view class="runtime-grid">
            <view v-for="item in runtimeFields" :key="item.key" class="field">
              <text>{{ item.label }}</text>
              <input v-model.number="runtimeConfig[item.key]" type="number" :placeholder="String(item.fallback)" />
            </view>
          </view>
          <view class="switch-row" style="margin-top:16rpx;padding-top:16rpx;border-top:2rpx dashed #ccc;">
            <view>
              <text class="field-title">前端 AI 文案显示</text>
              <text class="field-desc">开启显示"AI"，关闭显示"Crush算法"。保存后用户端下次启动生效。</text>
            </view>
            <button :class="['toggle-btn', showAILabel ? 'on' : 'off']" @click="showAILabel = !showAILabel">
              {{ showAILabel ? 'AI' : 'Crush算法' }}
            </button>
          </view>
        </view>

        <view class="settings-section">
          <view class="section-head">
            <text class="section-title">业务提示词</text>
            <text class="section-desc">非安全护栏类提示词全部从这里读取；代码不再提供业务提示词兜底。</text>
          </view>
          <view v-if="promptPolicyLines.length" class="policy-box">
            <text v-for="line in promptPolicyLines" :key="line" class="policy-line">{{ line }}</text>
          </view>
          <view class="module-tabs">
            <button
              v-for="module in promptModuleList"
              :key="module.key"
              :class="['module-tab', selectedPromptModuleKey === module.key ? 'active' : '']"
              @click="selectPromptModule(module.key)"
            >
              {{ module.title }}
            </button>
          </view>

          <view v-if="selectedPromptModule" class="prompt-editor">
            <view class="switch-row compact">
              <view>
                <text class="field-title">可编辑：{{ selectedPromptModule.title }}</text>
                <text class="field-desc">{{ selectedPromptMeta.description || '配置此调用的角色、任务、规则和输出要求。' }}</text>
              </view>
              <switch :checked="selectedPromptModule.enabled" @change="onPromptEnabledChange" />
            </view>

            <view class="form-grid">
              <view class="field">
                <text>中文名称</text>
                <input v-model="selectedPromptModule.businessPrompt.nameZh" />
              </view>
              <view class="field wide">
                <text>角色</text>
                <textarea v-model="selectedPromptModule.businessPrompt.roleZh" class="textarea small" :maxlength="-1" />
              </view>
              <view class="field wide">
                <text>任务</text>
                <textarea v-model="selectedPromptModule.businessPrompt.taskZh" class="textarea" :maxlength="-1" />
              </view>
              <view class="field wide">
                <text>业务规则（每行一条）</text>
                <textarea
                  :value="rulesDraft"
                  class="textarea large"
                  :maxlength="-1"
                  @blur="onRulesBlur"
                />
              </view>
              <view class="field wide">
                <text>输出要求（只写业务判断标准）</text>
                <textarea
                  v-model="outputNotesDraft"
                  class="textarea large editable-textarea"
                  :maxlength="-1"
                  placeholder="只写可调的业务判断标准。固定输入上下文、固定返回结构、固定返回要求已放到下方只读区。"
                  @blur="onOutputNotesBlur"
                />
              </view>
              <view class="field wide">
                <text>输出结构（JSON）</text>
                <textarea
                  :value="outputSchemaDraft"
                  class="textarea large mono"
                  :maxlength="-1"
                  @blur="onOutputSchemaBlur"
                />
              </view>
            </view>

            <view v-if="selectedPromptModuleKey === 'eventAssessment'" class="prompt-test-box">
              <view class="section-head inline-head">
                <view>
                  <text class="section-title">即时反馈实际提示词测试</text>
                  <text class="section-desc">输入一条首页快速记录，查看云函数实际传给模型的 system/user messages。记录内容用你的输入，画像/评分/最近事件用预览占位值；只预览，不调用模型，不消耗 token。</text>
                </view>
                <button class="small-btn preview-action" :disabled="promptPreviewLoading" @click="previewPrompt">
                  {{ promptPreviewLoading ? '生成中' : '生成预览' }}
                </button>
              </view>
              <textarea
                v-model="promptPreviewInput"
                class="textarea"
                :maxlength="-1"
                placeholder="例如：他今天主动约我下班后一起吃饭，还说只有我们两个人。"
              />
              <view class="field preview-case-field">
                <text>Crush（决定最近 3 次事件上下文）</text>
                <picker
                  v-if="promptPreviewCaseOptions.length > 0"
                  :range="promptPreviewCaseOptions"
                  range-key="name"
                  :value="Math.max(0, promptPreviewCaseOptions.findIndex((item: any) => item.id === promptPreviewCaseId))"
                  @change="onPromptPreviewCaseChange"
                >
                  <view class="picker-like">
                    {{ promptPreviewCaseOptions.find((item: any) => item.id === promptPreviewCaseId)?.name || '请选择 Crush' }}
                  </view>
                </picker>
                <view v-else class="picker-like muted-box">
                  当前账号下暂无可选 Crush
                </view>
              </view>
              <text v-if="promptPreviewMessage" class="test-result fail">{{ promptPreviewMessage }}</text>
              <text v-if="promptPreviewResult" class="preview-line">
                模型：{{ promptPreviewMeta.provider || '-' }} / {{ promptPreviewMeta.model || '-' }}
              </text>
              <view v-if="promptPreviewRecentTimeline.length" class="preview-context-box">
                <text class="preview-title small-title">本次送入的最近 3 次事件</text>
                <text
                  v-for="(item, index) in promptPreviewRecentTimeline"
                  :key="`${item.title}-${index}`"
                  class="preview-line"
                >
                  {{ index + 1 }}. {{ item.title || '[无标题]' }} / {{ item.type || '-' }} / {{ item.subjectRole || '-' }}
                </text>
              </view>
              <textarea
                v-if="promptPreviewResult"
                :value="promptPreviewResult"
                class="textarea prompt-preview-output mono"
                disabled
              />
            </view>

            <view class="preview-grid">
              <view class="preview-box">
                <text class="preview-title">安全护栏（只读）</text>
                <text v-for="item in selectedPromptMeta.guardrails" :key="item" class="preview-line">{{ item }}</text>
              </view>
              <view class="preview-box">
                <text class="preview-title">固定输入上下文（只读）</text>
                <text v-for="item in selectedPromptMeta.runtimeContext" :key="item" class="preview-line">{{ item }}</text>
              </view>
              <view class="preview-box">
                <text class="preview-title">固定输出结构（只读）</text>
                <text v-for="item in selectedPromptMeta.outputContract" :key="item" class="preview-line">{{ item }}</text>
              </view>
              <view class="preview-box">
                <text class="preview-title">最终拼接预览（只读）</text>
                <textarea :value="selectedPromptMeta.effectivePreview || ''" class="textarea preview-text mono" disabled />
              </view>
            </view>
          </view>

          <view class="prompt-overview">
            <view v-for="module in promptModuleList" :key="`overview-${module.key}`" class="prompt-overview-card">
              <view class="prompt-overview-head">
                <view>
                  <text class="prompt-overview-title">{{ module.title }} / {{ module.key }}</text>
                  <text class="panel-meta">{{ promptMetaFor(module.key).description || '当前 ' + aiLabel() + ' 调用模块' }}</text>
                </view>
                <text :class="['status-pill', module.enabled ? 'enabled' : 'disabled']">
                  {{ module.enabled ? '已启用' : '已停用' }}
                </text>
              </view>

              <view class="prompt-summary-grid">
                <view>
                  <text class="preview-title small-title">后台业务提示词</text>
                  <text class="preview-line">角色：{{ module.businessPrompt.roleZh || '[空]' }}</text>
                  <text class="preview-line">任务：{{ module.businessPrompt.taskZh || '[空]' }}</text>
                  <text class="preview-line">规则：{{ module.businessPrompt.rules.length }} 条</text>
                  <text class="preview-line">输出要求：{{ module.businessPrompt.outputNotes.length }} 条</text>
                </view>
                <view>
                  <text class="preview-title small-title">代码内只读护栏与上下文</text>
                  <text class="preview-line">安全护栏：{{ arrayCount(promptMetaFor(module.key).guardrails) }} 条</text>
                  <text class="preview-line">运行时上下文：{{ arrayCount(promptMetaFor(module.key).runtimeContext) }} 项</text>
                  <text class="preview-line">固定输出约束：{{ arrayCount(promptMetaFor(module.key).outputContract) }} 项</text>
                </view>
              </view>

            </view>
          </view>

        </view>

        <view class="settings-section">
          <view class="section-head">
            <text class="section-title">{{ aiLabel() }} 陪伴风格模板</text>
            <text class="section-desc">小程序用户只选择风格和强度；这里配置每个选项对应的文案。</text>
          </view>
          <view class="persona-grid">
            <view v-for="item in personaStyleList" :key="item.key" class="persona-card">
              <text class="persona-title">{{ item.title }}</text>
              <view class="field">
                <text>中文标签</text>
                <input v-model="personaConfig.styles[item.key].labelZh" />
              </view>
              <view class="field">
                <text>中文文案</text>
                <textarea v-model="personaConfig.styles[item.key].promptZh" class="textarea" :maxlength="-1" />
              </view>
            </view>
            <view v-for="item in personaBoldnessList" :key="item.key" class="persona-card">
              <text class="persona-title">{{ item.title }}</text>
              <view class="field">
                <text>中文标签</text>
                <input v-model="personaConfig.boldness[item.key].labelZh" />
              </view>
              <view class="field">
                <text>中文文案</text>
                <textarea v-model="personaConfig.boldness[item.key].promptZh" class="textarea" :maxlength="-1" />
              </view>
            </view>
          </view>
        </view>

        <view v-if="saveMessage" class="save-message">{{ saveMessage }}</view>
        <button class="primary-btn" :disabled="savingAI" @click="saveAISettings">
          {{ savingAI ? '保存中...' : '保存 AI 设置' }}
        </button>
      </view>

      <BillingPanel v-if="activeTab === 'billing'" @error="errorMessage = $event" />

      <!-- 订阅配置 -->
      <SubscriptionPanel v-if="activeTab === 'subscription'" />

      <FeedbackPanel v-if="activeTab === 'feedback'" @error="errorMessage = $event" />

      <!-- 各用户 Token 消耗 -->
      <TokenUsersPanel v-if="activeTab === 'tokenUsers'" />

      <CustomPetPanel v-if="activeTab === 'customPet'" @error="errorMessage = $event" />

      <OrdersPanel v-if="activeTab === 'orders'" @error="errorMessage = $event" />

      <LoginLogsPanel v-if="activeTab === 'loginLogs'" @error="errorMessage = $event" />
      <ReferralClaimsPanel v-if="activeTab === 'referralClaims'" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  adminDeleteUser,
  adminGetOverview,
  adminGetUserDetail,
  adminPreviewPrompt,
  adminUpdateAISettings,
  adminGetTokenLedger,
  adminUpdateUser,
  getCurrentUserId,
  logout,
  testAIConnection
} from '@/utils/api'
import { aiLabel } from '@/utils/labels'
import TokenUsersPanel from './components/panels/TokenUsersPanel.vue'
import OrdersPanel from './components/panels/OrdersPanel.vue'
import FeedbackPanel from './components/panels/FeedbackPanel.vue'
import CustomPetPanel from './components/panels/CustomPetPanel.vue'
import SubscriptionPanel from './components/panels/SubscriptionPanel.vue'
import BillingPanel from './components/panels/BillingPanel.vue'
import LoginLogsPanel from './components/panels/LoginLogsPanel.vue'
import ReferralClaimsPanel from './components/panels/ReferralClaimsPanel.vue'

type AdminUser = {
  id: string
  email: string
  phone: string
  loginType: string
  role: string
  isAdmin: boolean
  caseCount: number
}

type AdminDetail = {
  user: {
    id: string
    email: string
    phone: string
    isAdmin?: boolean
    plan?: string
    trialEndsAt?: string | null
    planExpiresAt?: string | null
    extraTokens?: number
    monthlyTokensUsed?: number
    inviteCode?: string
    createdAt: string
    updatedAt?: string
  }
  cases: Array<{
    id: string
    name: string
    createdAt: string
    updatedAt: string
    assessmentCount: number
    timelineCount: number
  }>
}

type AdminAIModel = {
  id: string
  name: string
  provider: string
  baseUrl: string
  model: string
  apiKey: string
  hasApiKey: boolean
  quota: number
  tokensUsed: number
  testMessage?: string
  testOk?: boolean
}

type BilingualLine = {
  zh: string
  en: string
}

type BusinessPrompt = {
  enabled: boolean
  nameZh: string
  nameEn: string
  roleZh: string
  roleEn: string
  taskZh: string
  taskEn: string
  rules: BilingualLine[]
  outputSchema: Record<string, any>
  outputNotes: BilingualLine[]
}

type PromptModule = {
  key: string
  title: string
  enabled: boolean
  businessPrompt: BusinessPrompt
}

type PersonaItem = {
  labelZh: string
  labelEn: string
  promptZh: string
  promptEn: string
}

type PersonaConfig = {
  styles: Record<string, PersonaItem>
  boldness: Record<string, PersonaItem>
}

let modelIdCounter = 1
const promptModuleKeys = ['eventAssessment', 'eventUnderstanding', 'weeklyReview', 'sideRead', 'attachmentAnalysis']

const petSpeakModuleKeys = [
  { key: 'qaStrategy', label: '撩一下策略' },
  { key: 'replyActive', label: '主动问对方' },
  { key: 'reply', label: '对方说了什么' },
  { key: 'replyStrategy', label: '多轮策略' },
  { key: 'lineTagging', label: '话术标签维护' },
  { key: 'qaMaintenance', label: 'QA维护批处理' }
]
const petSpeakActiveKey = ref('qaStrategy')
const petSpeakForm = reactive({ systemPrompt: '', temperature: null as number | null, maxTokens: null as number | null })
// 全量草稿，切换 tab 时保持未保存的修改
const petSpeakDraft: Record<string, { systemPrompt: string; temperature: number | null; maxTokens: number | null }> = {}

const petSpeakDefaults: Record<string, { systemPrompt: string; temperature: number; maxTokens: number }> = {
  qaStrategy: {
    systemPrompt: '你是撩人话术教练。用户想表达一个意图，你要从以下策略库中选最合适的2种，各生成一条一问一答式撩人话术。\n\n格式：每条用 | 分隔问和答，例如：在干嘛？|在想你。问和答各自独立完整。\n\n策略库（选2个最匹配用户意图的）：\n- 反转撩（contrast）：先推后拉。\n- 引导拉近（progressive）：埋钩子→试探亲密→引导见面。\n- 直球夸赞（direct）：干脆利落的表白/夸赞。\n- 幽默破冰（humor）：搞笑无厘头，松弛破冰。\n- 文艺情话（literary）：诗意比喻，浪漫氛围。\n\n主语视角：主语始终是"我"（用户本人）。用"我"和"你"的人称。\n关键：| 前的第一句话必须是主动发起的问句或开场白。\n\n返回 JSON：\n{"lines":[{"type":"contrast","label":"反转撩","text":"问|答"},{"type":"humor","label":"幽默破冰","text":"问|答"}]}',
    temperature: 0.85,
    maxTokens: 400
  },
  reply: {
    systemPrompt: '你是恋爱对话教练。对方说了一句话，用户不知道怎么回。请生成回复。只用 JSON 返回。每句15-40字，自然、尊重、有边界。',
    temperature: 0.8,
    maxTokens: 200
  },
  replyActive: {
    systemPrompt: '你是恋爱对话教练。用户想主动对心仪 Crush 说一句话，请生成回复。只用 JSON 返回。每句15-40字，自然、尊重、有边界。',
    temperature: 0.8,
    maxTokens: 200
  },
  replyStrategy: {
    systemPrompt: '你是恋爱对话策略教练。对方说了一句话或用户想表达一个意图，你需要生成2种多轮对话策略（反转撩和引导拉近）。',
    temperature: 0.8,
    maxTokens: 1200
  },
  lineTagging: {
    systemPrompt: '',
    temperature: 0.2,
    maxTokens: 2000
  },
  qaMaintenance: {
    systemPrompt: '',
    temperature: 0.3,
    maxTokens: 4000
  }
}

function switchPetSpeakKey(key: string) {
  // 保存当前 tab 的编辑状态
  petSpeakDraft[petSpeakActiveKey.value] = { ...petSpeakForm }
  petSpeakActiveKey.value = key
  // 恢复目标 tab 的编辑状态
  const saved = petSpeakDraft[key]
  if (saved) {
    petSpeakForm.systemPrompt = saved.systemPrompt
    petSpeakForm.temperature = saved.temperature
    petSpeakForm.maxTokens = saved.maxTokens
  }
}

function loadPetSpeakConfig(config: any) {
  petSpeakModuleKeys.forEach(({ key }) => {
    const sub = config?.[key] || {}
    petSpeakDraft[key] = {
      systemPrompt: sub.systemPrompt || '',
      temperature: sub.temperature != null ? sub.temperature : null,
      maxTokens: sub.maxTokens != null ? sub.maxTokens : null
    }
  })
  switchPetSpeakKey(petSpeakActiveKey.value)
}

function collectPetSpeakConfig(config: any) {
  if (!config) config = {}
  // 先把当前编辑状态写入 draft
  petSpeakDraft[petSpeakActiveKey.value] = { ...petSpeakForm }
  petSpeakModuleKeys.forEach(({ key }) => {
    const d = petSpeakDraft[key] || {}
    config[key] = {
      systemPrompt: d.systemPrompt || '',
      temperature: d.temperature ?? petSpeakDefaults[key].temperature,
      maxTokens: d.maxTokens ?? petSpeakDefaults[key].maxTokens
    }
  })
  return config
}

function restorePetSpeakDefault() {
  const def = petSpeakDefaults[petSpeakActiveKey.value]
  petSpeakForm.systemPrompt = def.systemPrompt
  petSpeakForm.temperature = def.temperature
  petSpeakForm.maxTokens = def.maxTokens
}

const personaStyleKeys = ['gentle_bestie', 'calm_strategist', 'playful_flirty', 'direct_sharp', 'careful_guardian']
const personaBoldnessKeys = ['conservative', 'balanced', 'bold']

const promptModuleTitles: Record<string, string> = {
  eventAssessment: '即时反馈',
  eventUnderstanding: '事件理解',
  weeklyReview: '近月度复盘',
  sideRead: '星象速写',
  attachmentAnalysis: '附件识别'
}

const personaStyleTitles: Record<string, string> = {
  gentle_bestie: '温柔闺蜜',
  calm_strategist: '冷静军师',
  playful_flirty: '轻松暧昧',
  direct_sharp: '不绕弯子',
  careful_guardian: '谨慎守护'
}

const personaBoldnessTitles: Record<string, string> = {
  conservative: '保守',
  balanced: '平衡',
  bold: '大胆'
}

const runtimeFields = [
  { key: 'eventContextLimit', label: '事件上下文条数', fallback: 3 },
  { key: 'weeklyEventLimit', label: '月度复盘事件条数', fallback: 10 },
  { key: 'weeklySideEventLimit', label: '月度星象速写事件条数', fallback: 6 },
  { key: 'eventMaxTokens', label: '即时反馈 Max Tokens', fallback: 650 },
  { key: 'eventUnderstandingMaxTokens', label: '事件理解 Max Tokens', fallback: 260 },
  { key: 'batchTagMaxTokens', label: '批量语义打标 Max Tokens', fallback: 600 },
  { key: 'eventUnderstandingTemperature', label: '事件理解温度', fallback: 0.1 },
  { key: 'weeklyMaxTokens', label: '月度复盘 Max Tokens', fallback: 650 },
  { key: 'sideReadMaxTokens', label: '星象速写 Max Tokens', fallback: 550 },
  { key: 'attachmentMaxTokens', label: '附件识别 Max Tokens', fallback: 1200 },
  { key: 'eventTemperature', label: '即时反馈温度', fallback: 0.2 },
  { key: 'batchTagTemperature', label: '批量语义打标温度', fallback: 0.1 },
  { key: 'weeklyTemperature', label: '月度复盘温度', fallback: 0.25 },
  { key: 'sideReadTemperature', label: '星象速写温度', fallback: 0.35 },
  { key: 'attachmentTemperature', label: '附件温度', fallback: 0.1 }
]

const activeTab = ref<'users' | 'ai' | 'billing' | 'subscription' | 'tokenUsers' | 'feedback' | 'customPet' | 'orders' | 'loginLogs'>('users')
const users = ref<AdminUser[]>([])
const selectedUserId = ref('')
const currentUserId = ref('')
const selectedDetail = ref<AdminDetail | null>(null)
const detailLoading = ref(false)
const errorMessage = ref('')
const saveMessage = ref('')
const savingAI = ref(false)
const testingModelId = ref('')
const defaultModelId = ref('default')
const models = ref<AdminAIModel[]>([createEmptyModel('default')])
const promptModules = reactive<Record<string, PromptModule>>({})
const promptAdminView = ref<any>({ policyLines: [], modules: {} })
const selectedPromptModuleKey = ref('eventAssessment')
const rulesDraft = ref('')
const outputNotesDraft = ref('')
const outputSchemaDraft = ref('{}')
const promptPreviewInput = ref('')
const promptPreviewCaseId = ref('')
const promptPreviewLoading = ref(false)
const promptPreviewResult = ref('')
const promptPreviewMessage = ref('')
const promptPreviewMeta = ref({ provider: '', model: '', baseUrl: '' })
const promptPreviewRecentTimeline = ref<Array<any>>([])
const runtimeConfig = reactive<Record<string, number>>({})
const showAILabel = ref(true)
const personaConfig = reactive<PersonaConfig>(createEmptyPersonaConfig())
// Token 额度配置（state）已抽到 components/panels/BillingPanel.vue

const stats = reactive({
  userCount: 0,
  caseCount: 0,
  aiEnabled: false
})
const aiForm = reactive({
  aiEnabled: false,
  aiFallbackToRules: true
})

const selectedUser = computed(() => users.value.find((user) => user.id === selectedUserId.value))
const currentUser = computed(() => users.value.find((user) => user.id === currentUserId.value))
const currentUserFromOverview = ref<Partial<AdminUser> | null>(null)
const localCurrentUser = ref<Partial<AdminUser> | null>(null)
const effectiveCurrentUserId = computed(() => currentUserFromOverview.value?.id || currentUserId.value)
const currentUserDisplay = computed(() => currentUserFromOverview.value?.email || currentUserFromOverview.value?.phone || currentUser.value?.email || currentUser.value?.phone || localCurrentUser.value?.email || localCurrentUser.value?.phone || effectiveCurrentUserId.value || '未识别')
const currentUserRole = computed(() => (currentUserFromOverview.value?.isAdmin || currentUser.value?.isAdmin || localCurrentUser.value?.isAdmin || localCurrentUser.value?.role === 'admin') ? '管理员' : '普通用户')
const promptModuleList = computed(() => promptModuleKeys.map((key) => promptModules[key]).filter(Boolean))
const selectedPromptModule = computed(() => promptModules[selectedPromptModuleKey.value])
const selectedPromptMeta = computed(() => promptAdminView.value?.modules?.[selectedPromptModuleKey.value] || {})
const promptPolicyLines = computed(() => Array.isArray(promptAdminView.value?.policyLines) ? promptAdminView.value.policyLines : [])
const personaStyleList = computed(() => personaStyleKeys.map((key) => ({ key, title: personaStyleTitles[key] || key })))
const personaBoldnessList = computed(() => personaBoldnessKeys.map((key) => ({ key, title: personaBoldnessTitles[key] || key })))
const promptPreviewCaseOptions = computed(() => selectedDetail.value?.cases || [])

onShow(() => {
  const uid = getCurrentUserId()
  if (!uid) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  currentUserId.value = uid
  localCurrentUser.value = readLocalCurrentUser(uid)
  refresh()
})

function readLocalCurrentUser(uid: string): Partial<AdminUser> {
  try {
    const cached = uni.getStorageSync('currentUser')
    const role = String(uni.getStorageSync('userRole') || cached?.role || '').trim()
    const isAdmin = Boolean(uni.getStorageSync('userIsAdmin') || cached?.isAdmin || role === 'admin')
    return {
      id: cached?.id || uid,
      email: cached?.email || uni.getStorageSync('userEmail') || '',
      phone: cached?.phone || uni.getStorageSync('userPhone') || '',
      role: role || (isAdmin ? 'admin' : 'user'),
      isAdmin
    }
  } catch {
    return { id: uid }
  }
}

function generateModelId() {
  return `model_${Date.now()}_${modelIdCounter++}`
}

function createEmptyModel(id = generateModelId()): AdminAIModel {
  return {
    id,
    name: id === 'default' ? '默认模型' : '',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKey: '',
    hasApiKey: false,
    quota: 0,
    tokensUsed: 0
  }
}

function createEmptyPersonaItem(): PersonaItem {
  return {
    labelZh: '',
    labelEn: '',
    promptZh: '',
    promptEn: ''
  }
}

function createEmptyPersonaConfig(): PersonaConfig {
  return {
    styles: personaStyleKeys.reduce((result, key) => {
      result[key] = createEmptyPersonaItem()
      return result
    }, {} as Record<string, PersonaItem>),
    boldness: personaBoldnessKeys.reduce((result, key) => {
      result[key] = createEmptyPersonaItem()
      return result
    }, {} as Record<string, PersonaItem>)
  }
}

function createEmptyBusinessPrompt(key: string): BusinessPrompt {
  return {
    enabled: true,
    nameZh: promptModuleTitles[key] || key,
    nameEn: key,
    roleZh: '',
    roleEn: '',
    taskZh: '',
    taskEn: '',
    rules: [],
    outputSchema: {},
    outputNotes: []
  }
}

function normalizeBilingualList(value: any): BilingualLine[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (typeof item === 'string') return { zh: item, en: '' }
    return {
      zh: String(item?.zh || ''),
      en: String(item?.en || '')
    }
  }).filter((item) => item.zh || item.en)
}

function normalizePromptModule(key: string, raw: any): PromptModule {
  const source = raw && typeof raw === 'object' ? raw : {}
  const business = source.businessPrompt && typeof source.businessPrompt === 'object'
    ? source.businessPrompt
    : source
  const fallback = createEmptyBusinessPrompt(key)
  return {
    key,
    title: promptModuleTitles[key] || key,
    enabled: source.enabled !== false && business.enabled !== false,
    businessPrompt: {
      enabled: source.enabled !== false && business.enabled !== false,
      nameZh: String(business.nameZh || fallback.nameZh),
      nameEn: String(business.nameEn || fallback.nameEn),
      roleZh: String(business.roleZh || ''),
      roleEn: String(business.roleEn || ''),
      taskZh: String(business.taskZh || ''),
      taskEn: String(business.taskEn || ''),
      rules: normalizeBilingualList(business.rules),
      outputSchema: business.outputSchema && typeof business.outputSchema === 'object' ? business.outputSchema : {},
      outputNotes: normalizeBilingualList(business.outputNotes)
    }
  }
}

function legacyPromptToModule(key: string, raw: any): PromptModule {
  const source = raw && typeof raw === 'object' ? raw : {}
  const fallback = createEmptyBusinessPrompt(key)
  const goal = String(source.goal || '')
  const extraPrompt = String(source.extraPrompt || '')
  return normalizePromptModule(key, {
    enabled: source.enabled !== false,
    businessPrompt: {
      enabled: source.enabled !== false,
      nameZh: fallback.nameZh,
      nameEn: fallback.nameEn,
      roleZh: goal,
      roleEn: '',
      taskZh: goal,
      taskEn: '',
      rules: normalizeBilingualList(source.rules),
      outputSchema: {},
      outputNotes: extraPrompt ? [{ zh: extraPrompt, en: '' }] : []
    }
  })
}

function hasPromptModuleValue(value: any) {
  if (!value || typeof value !== 'object') return false
  const business = value.businessPrompt && typeof value.businessPrompt === 'object'
    ? value.businessPrompt
    : value
  return Boolean(
    business.roleZh ||
    business.roleEn ||
    business.taskZh ||
    business.taskEn ||
    (Array.isArray(business.rules) && business.rules.length > 0) ||
    (Array.isArray(business.outputNotes) && business.outputNotes.length > 0)
  )
}

function applyPromptModules(raw: any, legacyRaw: any = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const legacySource = legacyRaw && typeof legacyRaw === 'object' ? legacyRaw : {}
  for (const key of promptModuleKeys) {
    promptModules[key] = hasPromptModuleValue(source[key])
      ? normalizePromptModule(key, source[key])
      : legacyPromptToModule(key, legacySource[key])
  }
}

function applyRuntimeConfig(raw: any) {
  const source = raw && typeof raw === 'object' ? raw : {}
  for (const field of runtimeFields) {
    runtimeConfig[field.key] = Number.isFinite(Number(source[field.key])) ? Number(source[field.key]) : field.fallback
  }
  showAILabel.value = source.showAILabel !== 0
}

function applyPersonaConfig(raw: any) {
  const source = raw && typeof raw === 'object' ? raw : {}
  for (const key of personaStyleKeys) {
    const item = source.styles?.[key] || {}
    personaConfig.styles[key] = {
      labelZh: String(item.labelZh || ''),
      labelEn: String(item.labelEn || ''),
      promptZh: String(item.promptZh || ''),
      promptEn: String(item.promptEn || '')
    }
  }
  for (const key of personaBoldnessKeys) {
    const item = source.boldness?.[key] || {}
    personaConfig.boldness[key] = {
      labelZh: String(item.labelZh || ''),
      labelEn: String(item.labelEn || ''),
      promptZh: String(item.promptZh || ''),
      promptEn: String(item.promptEn || '')
    }
  }
}

function toBilingualText(list: BilingualLine[]) {
  return stripFixedPromptBlocks(list.map((item) => item.zh || item.en).filter(Boolean).join('\n'))
}

function parseBilingualText(value: any): BilingualLine[] {
  return String(value?.detail?.value ?? value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ zh: line, en: '' }))
}

function stripFixedPromptBlocks(value: any) {
  const lines = String(value ?? '').replace(/\r\n/g, '\n').split('\n')
  const result: string[] = []
  let skipping = false
  const fixedHeadPattern = /^(固定输入上下文|固定返回结构|固定返回要求)\s*[：:]?\s*$/
  const editableHeadPattern = /^(业务判断标准|判断标准|输出要求|业务规则)\s*[：:]?\s*$/
  for (const line of lines) {
    const trimmed = line.trim()
    if (fixedHeadPattern.test(trimmed)) {
      skipping = true
      continue
    }
    if (skipping && editableHeadPattern.test(trimmed)) {
      skipping = false
      result.push(line)
      continue
    }
    if (skipping) continue
    result.push(line)
  }
  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function parseOutputNotesText(value: any): BilingualLine[] {
  const text = stripFixedPromptBlocks(value?.detail?.value ?? value ?? '')
  return text ? [{ zh: text, en: '' }] : []
}

function buildPromptModulesPayload() {
  syncSelectedPromptFromDrafts()
  return promptModuleKeys.reduce((result, key) => {
    const module = promptModules[key] || normalizePromptModule(key, null)
    result[key] = {
      enabled: module.enabled,
      businessPrompt: {
        ...module.businessPrompt,
        enabled: module.enabled,
        nameEn: '',
        roleEn: '',
        taskEn: '',
        rules: (module.businessPrompt.rules || []).map((item) => ({ zh: item.zh || item.en || '', en: '' })).filter((item) => item.zh),
        outputNotes: (module.businessPrompt.outputNotes || []).map((item) => ({ zh: stripFixedPromptBlocks(item.zh || item.en || ''), en: '' })).filter((item) => item.zh)
      }
    }
    return result
  }, {} as Record<string, any>)
}

function buildPersonaConfigPayload() {
  return {
    styles: personaStyleKeys.reduce((result, key) => {
      const item = personaConfig.styles[key] || createEmptyPersonaItem()
      result[key] = { labelZh: item.labelZh, labelEn: '', promptZh: item.promptZh, promptEn: '' }
      return result
    }, {} as Record<string, PersonaItem>),
    boldness: personaBoldnessKeys.reduce((result, key) => {
      const item = personaConfig.boldness[key] || createEmptyPersonaItem()
      result[key] = { labelZh: item.labelZh, labelEn: '', promptZh: item.promptZh, promptEn: '' }
      return result
    }, {} as Record<string, PersonaItem>)
  }
}

function syncPromptDrafts() {
  const module = selectedPromptModule.value
  const business = module?.businessPrompt
  rulesDraft.value = toBilingualText(business?.rules || [])
  outputNotesDraft.value = toBilingualText(business?.outputNotes || [])
  outputSchemaDraft.value = JSON.stringify(business?.outputSchema || {}, null, 2)
}

function syncSelectedPromptFromDrafts(options: { refreshDrafts?: boolean } = {}) {
  const module = selectedPromptModule.value
  if (!module) return
  module.businessPrompt.rules = parseBilingualText(rulesDraft.value)
  module.businessPrompt.outputNotes = parseOutputNotesText(outputNotesDraft.value)
  const schemaText = outputSchemaDraft.value.trim()
  if (!schemaText) {
    module.businessPrompt.outputSchema = {}
    return
  }
  try {
    module.businessPrompt.outputSchema = JSON.parse(schemaText)
  } catch {
    // Keep the last valid schema while the admin is editing invalid JSON.
  }
  if (options.refreshDrafts) syncPromptDrafts()
}

function selectPromptModule(key: string) {
  if (key === selectedPromptModuleKey.value) return
  syncSelectedPromptFromDrafts()
  selectedPromptModuleKey.value = key
  syncPromptDrafts()
}

function promptMetaFor(key: string) {
  return promptAdminView.value?.modules?.[key] || {}
}

function arrayCount(value: any) {
  return Array.isArray(value) ? value.length : 0
}

function normalizeModel(raw: any, index: number): AdminAIModel {
  return {
    id: raw?.id || (index === 0 ? 'default' : generateModelId()),
    name: raw?.name || '',
    provider: raw?.provider || 'deepseek',
    baseUrl: raw?.baseUrl || 'https://api.deepseek.com/v1',
    model: raw?.model || 'deepseek-chat',
    apiKey: '',
    hasApiKey: Boolean(raw?.hasApiKey || raw?.apiKey),
    quota: Number(raw?.quota || 0),
    tokensUsed: Number(raw?.tokensUsed || 0)
  }
}

function applyOverview(result: any) {
  users.value = result.users || []
  currentUserFromOverview.value = result.currentUser || null
  if (!currentUserId.value && result.currentUser?.id) currentUserId.value = result.currentUser.id
  stats.userCount = result.stats?.userCount || 0
  stats.caseCount = result.stats?.caseCount || 0
  stats.aiEnabled = Boolean(result.stats?.aiEnabled)

  const settings = result.aiSettings || {}
  aiForm.aiEnabled = Boolean(settings.aiEnabled)
  aiForm.aiFallbackToRules = settings.aiFallbackToRules !== false

  if (Array.isArray(settings.aiModels) && settings.aiModels.length > 0) {
    models.value = settings.aiModels.map(normalizeModel)
  } else {
    models.value = [createEmptyModel('default')]
  }

  defaultModelId.value = settings.aiDefaultModelId || models.value[0]?.id || 'default'
  if (!models.value.some((model) => model.id === defaultModelId.value)) {
    defaultModelId.value = models.value[0]?.id || 'default'
  }
  promptAdminView.value = settings.promptAdminView || { policyLines: [], modules: {} }
  applyPromptModules(settings.promptModules, settings.promptConfig)
  syncPromptDrafts()
  applyRuntimeConfig(settings.runtimeConfig)
  showAILabel.value = settings.showAILabel !== 0
  applyPersonaConfig(settings.personaConfig)
  loadPetSpeakConfig(settings.petSpeakConfig)
  if (!promptPreviewCaseId.value) {
    promptPreviewCaseId.value = ''
  }
}

async function refresh() {
  errorMessage.value = ''
  saveMessage.value = ''
  try {
    const result = await adminGetOverview()
    if (!result?.success) {
      errorMessage.value = result?.message || '后台数据读取失败'
      return
    }
    applyOverview(result)
    const autoUserId = result.currentUser?.id || currentUserId.value
    if (autoUserId && (!selectedDetail.value || selectedUserId.value !== autoUserId)) {
      await selectUser(autoUserId)
    }
  } catch (error: any) {
    errorMessage.value = error?.message || '后台数据读取失败'
  }
}

async function handleLogout() {
  await logout()
  uni.reLaunch({ url: '/pages/login/login' })
}

async function goAdminLogin() {
  await logout()
  uni.reLaunch({ url: '/pages/login/login?admin=1' })
}

async function selectUser(userId: string) {
  selectedUserId.value = userId
  selectedDetail.value = null
  promptPreviewCaseId.value = ''
  promptPreviewRecentTimeline.value = []
  userEditMsg.value = ''
  detailLoading.value = true
  errorMessage.value = ''
  try {
    const result = await adminGetUserDetail(userId)
    if (result?.success) {
      selectedDetail.value = result
      promptPreviewCaseId.value = result.cases?.[0]?.id || ''
      // 填充编辑表单
      const u = result.user || {}
      userEditForm.plan = u.plan || 'free'
      userEditForm.isAdmin = Boolean(u.isAdmin)
      userEditForm.trialEndsAt = u.trialEndsAt ? u.trialEndsAt.slice(0, 10) : ''
      userEditForm.planExpiresAt = u.planExpiresAt ? u.planExpiresAt.slice(0, 10) : ''
      userEditForm.extraTokens = Number(u.extraTokens || 0)
      userEditForm.monthlyTokensUsed = Number(u.monthlyTokensUsed || 0)
      userEditForm.inviteCode = u.inviteCode || ''
    } else {
      errorMessage.value = result?.message || '用户详情读取失败'
    }
  } catch (error: any) {
    errorMessage.value = error?.message || '用户详情读取失败'
  } finally {
    detailLoading.value = false
  }
}

const userEditForm = reactive({
  plan: 'free',
  isAdmin: false,
  trialEndsAt: '',
  planExpiresAt: '',
  extraTokens: 0,
  monthlyTokensUsed: 0,
  inviteCode: ''
})
const userEditSaving = ref(false)
const userEditMsg = ref('')
const userEditOk = ref(false)
const planOptions = ['free', 'pro', 'ultra']

function planLabelText(plan: string) {
  return plan === 'free' ? '免费版' : plan === 'pro' ? 'Pro' : plan === 'ultra' ? 'Ultra' : plan
}

function onPlanChange(e: any) {
  userEditForm.plan = planOptions[Number(e.detail.value)] || 'free'
}

async function saveUserEdit() {
  if (!selectedUserId.value) return

  // 确认弹窗
  const confirmed = await new Promise<boolean>(resolve => {
    uni.showModal({
      title: '确认保存',
      content: `确定要修改此用户的信息吗？\n套餐: ${userEditForm.plan}\n管理员: ${userEditForm.isAdmin ? '是' : '否'}\n试用到期: ${userEditForm.trialEndsAt || '无'}\n套餐到期: ${userEditForm.planExpiresAt || '无'}\n加油包: ${userEditForm.extraTokens}\n本月已用: ${userEditForm.monthlyTokensUsed}`,
      success: (res: any) => resolve(res.confirm),
      fail: () => resolve(false)
    })
  })
  if (!confirmed) return

  userEditSaving.value = true
  userEditMsg.value = ''
  userEditOk.value = false
  try {
    const patch: Record<string, any> = {
      plan: userEditForm.plan,
      isAdmin: userEditForm.isAdmin,
      trialEndsAt: userEditForm.trialEndsAt || null,
      planExpiresAt: userEditForm.planExpiresAt || null,
      extraTokens: Number(userEditForm.extraTokens) || 0,
      monthlyTokensUsed: Number(userEditForm.monthlyTokensUsed) || 0,
      inviteCode: userEditForm.inviteCode || ''
    }
    const result = await adminUpdateUser(selectedUserId.value, patch)
    if (result?.success) {
      userEditMsg.value = '用户信息已保存'
      userEditOk.value = true
      // 刷新顶部用户列表（让套餐列更新）
      await refresh()
    } else {
      userEditMsg.value = result?.message || '保存失败'
    }
  } catch (e: any) {
    userEditMsg.value = e?.message || '保存失败'
  } finally {
    userEditSaving.value = false
  }
}

const deleteUserLoading = ref(false)

function confirmDeleteUser() {
  const target = selectedDetail.value?.user
  if (!target?.id) return
  uni.showModal({
    title: '确认删除',
    content: `确定要删除用户「${target.email || target.phone || target.id}」吗？\n此操作不可恢复，将同时删除该用户的所有 Crush、记录和分析数据。`,
    confirmText: '确认删除',
    cancelText: '取消',
    success(res: any) {
      if (res.confirm) executeDeleteUser(target.id)
    }
  })
}

async function executeDeleteUser(userId: string) {
  deleteUserLoading.value = true
  try {
    const result = await adminDeleteUser(userId)
    if (result?.success) {
      uni.showToast({ title: result.message || '已删除', icon: 'success' })
      selectedUserId.value = ''
      selectedDetail.value = null
      await refresh()
    } else {
      uni.showToast({ title: result?.message || '删除失败', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '删除失败', icon: 'none' })
  } finally {
    deleteUserLoading.value = false
  }
}

function onTrialDateChange(e: any) {
  userEditForm.trialEndsAt = e.detail.value
}
function onPlanDateChange(e: any) {
  userEditForm.planExpiresAt = e.detail.value
}

function onAIEnabledChange(event: any) {
  aiForm.aiEnabled = Boolean(event.detail?.value)
}

function onFallbackChange(event: any) {
  aiForm.aiFallbackToRules = Boolean(event.detail?.value)
}

function onPromptEnabledChange(event: any) {
  const module = selectedPromptModule.value
  if (!module) return
  module.enabled = Boolean(event.detail?.value)
  module.businessPrompt.enabled = module.enabled
}

function onRulesBlur(event: any) {
  const module = selectedPromptModule.value
  if (!module) return
  rulesDraft.value = String(event?.detail?.value ?? '')
  syncSelectedPromptFromDrafts({ refreshDrafts: true })
}

function onOutputNotesBlur(event: any) {
  const module = selectedPromptModule.value
  if (!module) return
  outputNotesDraft.value = stripFixedPromptBlocks(event?.detail?.value ?? '')
  module.businessPrompt.outputNotes = parseOutputNotesText(outputNotesDraft.value)
}

function onOutputSchemaBlur(event: any) {
  const module = selectedPromptModule.value
  if (!module) return
  outputSchemaDraft.value = String(event?.detail?.value ?? '')
  const before = JSON.stringify(module.businessPrompt.outputSchema || {})
  syncSelectedPromptFromDrafts({ refreshDrafts: true })
  const after = JSON.stringify(module.businessPrompt.outputSchema || {})
  if (before === after && outputSchemaDraft.value.trim()) {
    try {
      JSON.parse(outputSchemaDraft.value)
    } catch {
      saveMessage.value = '输出结构 JSON 暂未保存：格式不正确'
    }
  }
}

function onPromptPreviewCaseChange(event: any) {
  const index = Number(event?.detail?.value ?? -1)
  const item = promptPreviewCaseOptions.value[index]
  promptPreviewCaseId.value = item?.id || ''
}

async function previewPrompt() {
  const content = promptPreviewInput.value.trim()
  if (!content) {
    promptPreviewMessage.value = '请先输入一条记录内容'
    promptPreviewResult.value = ''
    return
  }
  if (!promptPreviewCaseId.value) {
    promptPreviewMessage.value = '请先选择一个 Crush'
    promptPreviewResult.value = ''
    return
  }

  promptPreviewLoading.value = true
  promptPreviewMessage.value = ''
  promptPreviewResult.value = ''
  promptPreviewRecentTimeline.value = []
  try {
    syncSelectedPromptFromDrafts()
    const result = await adminPreviewPrompt({
      moduleKey: 'eventAssessment',
      caseId: promptPreviewCaseId.value,
      recordContent: content,
      draftSettings: {
        promptModules: buildPromptModulesPayload(),
        personaConfig,
        runtimeConfig
      }
    })
    if (!result?.success) {
      promptPreviewMessage.value = result?.message || '提示词预览生成失败'
      return
    }
    promptPreviewMeta.value = {
      provider: String(result.provider || ''),
      model: String(result.model || ''),
      baseUrl: String(result.baseUrl || '')
    }
    promptPreviewRecentTimeline.value = Array.isArray(result.recentTimeline) ? result.recentTimeline : []
    promptPreviewResult.value = String(result.promptText || '')
  } catch (error: any) {
    promptPreviewMessage.value = error?.message || '提示词预览生成失败'
  } finally {
    promptPreviewLoading.value = false
  }
}

function addModel() {
  const model = createEmptyModel()
  models.value.push(model)
  if (!defaultModelId.value) defaultModelId.value = model.id
}

function removeModel(index: number) {
  const removed = models.value[index]
  models.value.splice(index, 1)
  if (removed?.id === defaultModelId.value) {
    defaultModelId.value = models.value[0]?.id || ''
  }
}

function setDefaultModel(modelId: string) {
  defaultModelId.value = modelId
  saveMessage.value = ''
}

function collectModels() {
  return models.value.map((model, index) => ({
    id: model.id || (index === 0 ? 'default' : generateModelId()),
    name: model.name || '未命名模型',
    provider: model.provider || 'deepseek',
    baseUrl: model.baseUrl || 'https://api.deepseek.com/v1',
    model: model.model || 'deepseek-chat',
    apiKey: model.apiKey || '',
    quota: Number(model.quota || 0)
  }))
}

async function saveAISettings() {
  if (models.value.length === 0) {
    errorMessage.value = '至少保留一个 AI 模型'
    return
  }

  savingAI.value = true
  saveMessage.value = ''
  errorMessage.value = ''
  try {
    const result = await adminUpdateAISettings({
      aiEnabled: aiForm.aiEnabled,
      aiFallbackToRules: aiForm.aiFallbackToRules,
      defaultModelId: defaultModelId.value || models.value[0].id,
      models: collectModels(),
      promptModules: buildPromptModulesPayload(),
      petSpeakConfig: collectPetSpeakConfig({}),
      personaConfig: buildPersonaConfigPayload(),
      runtimeConfig,
      showAILabel: showAILabel.value ? 1 : 0
    })
    if (!result?.success) {
      errorMessage.value = result?.message || aiLabel() + ' 设置保存失败'
      return
    }
    saveMessage.value = aiLabel() + ' 设置已保存'
    await refresh()
  } catch (error: any) {
    errorMessage.value = error?.message || aiLabel() + ' 设置保存失败'
  } finally {
    savingAI.value = false
  }
}

async function testModel(model: AdminAIModel) {
  const hasUsableKey = Boolean(model.apiKey || model.hasApiKey)
  if (!hasUsableKey) {
    model.testOk = false
    model.testMessage = '请先填写 API Key'
    return
  }

  testingModelId.value = model.id
  model.testMessage = ''
  try {
    const result = model.apiKey
      ? await testAIConnection({
        aiProvider: model.provider,
        aiApiKey: model.apiKey,
        aiBaseUrl: model.baseUrl,
        aiModel: model.model
      })
      : await testAIConnection({ modelId: model.id })

    model.testOk = Boolean(result?.success)
    model.testMessage = result?.success
      ? `测试通过：${result.summary || result.model || '连接成功'}`
      : `测试失败：${result?.message || '连接失败'}`
  } catch (error: any) {
    model.testOk = false
    model.testMessage = `测试失败：${error?.message || '连接失败'}`
  } finally {
    testingModelId.value = ''
  }
}

// Token 额度配置（方法 + watch 懒加载）已抽到 components/panels/BillingPanel.vue（组件改为 onMounted 自加载）

// 反馈管理（state + 方法）已抽到 components/panels/FeedbackPanel.vue

// 订阅配置（方法）已抽到 components/panels/SubscriptionPanel.vue

// （反馈管理方法已移至 FeedbackPanel.vue）

// 宠物定制需求 → 已抽到 components/panels/CustomPetPanel.vue（并修复了交付输入框 v-if 用未定义变量导致 in_progress 项渲染崩溃的 bug）

// 订单管理 → 已抽到 components/panels/OrdersPanel.vue（并修复了原来误嵌在 customPet 内、整 tab 不渲染的 bug）

function planTagClass(user: any) {
  if (user.planLabel === '试用期') return 'plan-trial'
  if (user.planLabel === 'Pro') return 'plan-pro'
  if (user.planLabel === 'Ultra') return 'plan-ultra'
  return 'plan-free'
}

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #eef3ef;
  color: #17231f;
  padding: 24px;
  box-sizing: border-box;
}

.admin-shell {
  max-width: 1180px;
  margin: 0 auto;
}

/* 侧边栏布局（Phase 4：Tab → 左侧分组菜单 + 右内容） */
.admin-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  align-items: start;
}
.admin-sidebar {
  position: sticky;
  top: 24px;
  background: #123c36;
  border-radius: 10px;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sidebar-brand {
  display: block;
  padding: 6px 12px 14px;
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 1px;
}
.sidebar-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.sidebar-group-title {
  display: block;
  padding: 8px 12px 4px;
  color: #7fa99d;
  font-size: 12px;
  font-weight: 700;
}
.sidebar-item {
  padding: 10px 12px;
  border-radius: 6px;
  color: #cfe3dc;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-left: 3px solid transparent;
}
.sidebar-item:hover {
  background: rgba(255, 255, 255, 0.06);
}
.sidebar-item.active {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-left-color: #FFD93D;
}
.admin-main {
  min-width: 0;
}
@media (max-width: 900px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }
  .admin-sidebar {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
  }
  .sidebar-group {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 0;
  }
}

.topbar,
.panel,
.stat-card {
  background: #fbfdfb;
  border: 1px solid rgba(23, 35, 31, 0.08);
  border-radius: 8px;
  box-shadow: 0 12px 28px rgba(23, 35, 31, 0.06);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22px 24px;
  margin-bottom: 18px;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-user-line {
  display: block;
  margin-top: 8px;
  color: #42524b;
  font-size: 14px;
  line-height: 1.45;
}

.current-user-card {
  min-width: 260px;
  padding: 10px 12px;
  border: 1px solid rgba(18, 60, 54, 0.12);
  border-radius: 8px;
  background: #f4f8f5;
}

.current-user-label {
  display: block;
  color: #68766f;
  font-size: 12px;
}

.current-user-id {
  display: block;
  margin-top: 4px;
  color: #17231f;
  font-size: 13px;
}

.eyebrow,
.panel-meta,
.stat-label,
.field-desc,
.hint,
.case-meta {
  display: block;
  color: #68766f;
  font-size: 13px;
  line-height: 1.5;
}

.title {
  display: block;
  margin-top: 4px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.15;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card {
  padding: 18px;
}

.stat-value {
  display: block;
  margin-top: 8px;
  font-size: 26px;
  font-weight: 700;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

button {
  margin: 0;
}

.tab-btn,
.ghost-btn,
.primary-btn,
.small-btn {
  border-radius: 6px;
  font-size: 15px;
}

.tab-btn {
  width: auto;
  min-width: 120px;
  height: 42px;
  line-height: 42px;
  color: #26433b;
  background: #fbfdfb;
  border: 1px solid rgba(38, 67, 59, 0.16);
}

.tab-btn.active,
.primary-btn,
.small-btn.active {
  color: #fff;
  background: #123c36;
}

.ghost-btn {
  width: 88px;
  height: 38px;
  line-height: 38px;
  color: #123c36;
  background: #eef6f2;
  border: 1px solid rgba(18, 60, 54, 0.18);
}

.wide-btn {
  width: 104px;
}

.danger-btn {
  width: 104px;
  color: #9c2f22;
  background: #fff6f4;
  border-color: rgba(156, 47, 34, 0.25);
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
  gap: 16px;
}

.panel {
  padding: 20px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.panel-title {
  display: block;
  font-size: 20px;
  font-weight: 700;
}

.table {
  border: 1px solid rgba(23, 35, 31, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.table-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.7fr) minmax(90px, 0.7fr) 70px 80px;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-top: 1px solid rgba(23, 35, 31, 0.08);
  font-size: 14px;
}

.table-row:first-child {
  border-top: 0;
}

.table-header {
  color: #68766f;
  background: #f3f7f4;
  font-weight: 700;
}

.table-row.selected {
  background: #edf7f2;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
}

.empty {
  padding: 22px;
  color: #68766f;
  background: #f4f7f4;
  border-radius: 8px;
}

.detail-line {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(23, 35, 31, 0.08);
}

.detail-label {
  color: #68766f;
}

.case-list {
  margin-top: 16px;
}

.case-item {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  margin-top: 10px;
  border: 1px solid rgba(23, 35, 31, 0.08);
  border-radius: 8px;
  background: #f8faf7;
}

.case-name {
  display: block;
  font-weight: 700;
}

.case-counts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #42524b;
  font-size: 13px;
  text-align: right;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 0;
  border-top: 1px solid rgba(23, 35, 31, 0.08);
}

.switch-row:first-of-type {
  border-top: 0;
}

.field-title {
  display: block;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}

.model-card {
  padding: 18px;
  margin-top: 12px;
  background: #f7faf7;
  border: 1px solid rgba(23, 35, 31, 0.08);
  border-radius: 8px;
}

.model-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.model-title {
  display: block;
  font-size: 17px;
  font-weight: 700;
}

.model-subtitle {
  display: block;
  margin-top: 4px;
  color: #68766f;
  font-size: 13px;
}

.model-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.small-btn {
  width: auto;
  min-width: 74px;
  height: 34px;
  line-height: 34px;
  padding: 0 12px;
  color: #123c36;
  background: #fbfdfb;
  border: 1px solid rgba(18, 60, 54, 0.18);
  font-size: 13px;
}

.small-btn.danger {
  color: #9c2f22;
  border-color: rgba(156, 47, 34, 0.25);
  background: #fff6f4;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #42524b;
  font-size: 13px;
}

.field.wide {
  grid-column: span 2;
}

input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid rgba(23, 35, 31, 0.14);
  border-radius: 6px;
  background: #fff;
  color: #17231f;
  font-size: 14px;
}

.model-foot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.settings-section {
  padding-top: 18px;
  margin-top: 18px;
  border-top: 1px solid rgba(23, 35, 31, 0.08);
}

.pet-speak-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.pet-speak-tab {
  padding: 6px 18px;
  font-size: 15px;
  font-weight: 700;
  color: #666;
  background: #fff;
  border: 2px solid #ddd;
  border-radius: 20px;
  cursor: pointer;
  white-space: nowrap;
}

.pet-speak-tab.active {
  background: #4ECDC4;
  color: #fff;
  border-color: #4ECDC4;
}

.section-head {
  margin-bottom: 14px;
}

.section-title,
.preview-title,
.persona-title {
  display: block;
  font-size: 17px;
  font-weight: 700;
  color: #17231f;
}

.section-desc {
  display: block;
  margin-top: 4px;
  color: #68766f;
  font-size: 13px;
  line-height: 1.5;
}

.runtime-grid,
.persona-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.policy-box,
.preview-box,
.persona-card {
  padding: 14px;
  background: #f7faf7;
  border: 1px solid rgba(23, 35, 31, 0.08);
  border-radius: 8px;
}

.policy-line,
.preview-line {
  display: block;
  color: #42524b;
  font-size: 13px;
  line-height: 1.55;
  margin-top: 6px;
  white-space: pre-wrap;
}

.module-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
}

.module-tab {
  width: auto;
  min-width: 92px;
  height: 34px;
  line-height: 34px;
  padding: 0 12px;
  color: #123c36;
  background: #fbfdfb;
  border: 1px solid rgba(18, 60, 54, 0.18);
  border-radius: 6px;
  font-size: 13px;
}

.module-tab.active {
  color: #fff;
  background: #123c36;
}

.prompt-overview {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}

.prompt-overview-card {
  padding: 14px;
  border: 1px solid rgba(23, 35, 31, 0.08);
  border-radius: 8px;
  background: #fbfdfb;
}

.prompt-overview-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.prompt-overview-title {
  display: block;
  color: #17231f;
  font-size: 16px;
  font-weight: 700;
}

.status-pill {
  flex: 0 0 auto;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
}

.status-pill.enabled {
  color: #0f6b45;
  background: #e6f4ec;
}

.status-pill.disabled {
  color: #9c2f22;
  background: #fff0ed;
}

.prompt-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 10px;
}

.small-title {
  font-size: 14px;
}

.prompt-editor {
  padding: 14px;
  border: 1px solid rgba(23, 35, 31, 0.08);
  border-radius: 8px;
  background: #fbfdfb;
}

.switch-row.compact {
  padding-top: 0;
}

.prompt-test-box {
  padding: 14px;
  margin-top: 14px;
  border: 1px solid rgba(18, 60, 54, 0.14);
  border-radius: 8px;
  background: #f7faf7;
}

.inline-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.preview-action {
  flex: 0 0 auto;
  min-width: 92px;
}

.preview-case-field {
  margin-top: 12px;
}

.picker-like,
.preview-context-box {
  padding: 10px 12px;
  border: 1px solid rgba(23, 35, 31, 0.14);
  border-radius: 6px;
  background: #fff;
}

.preview-context-box {
  margin-top: 12px;
}

.muted-box {
  color: #68766f;
  background: #f6f8f6;
}

.textarea {
  width: 100%;
  min-height: 96px;
  padding: 10px 12px;
  box-sizing: border-box;
  border: 1px solid rgba(23, 35, 31, 0.14);
  border-radius: 6px;
  background: #fff;
  color: #17231f;
  font-size: 14px;
  line-height: 1.5;
}

.textarea.small {
  min-height: 72px;
}

.textarea.large {
  min-height: 132px;
}

.editable-textarea {
  border-color: rgba(18, 60, 54, 0.32);
  background: #fff;
}

.preview-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 14px;
  margin-top: 14px;
}

.preview-text {
  min-height: 280px;
  margin-top: 10px;
}

.prompt-preview-output {
  min-height: 360px;
  margin-top: 10px;
}

.persona-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.test-result {
  display: block;
  font-size: 13px;
  line-height: 1.45;
}

.test-result.pass {
  color: #0f6b45;
}

.test-result.fail {
  color: #9c2f22;
}

.primary-btn {
  width: 180px;
  height: 44px;
  line-height: 44px;
  margin-top: 18px;
}

.alert,
.save-message {
  padding: 12px 14px;
  margin-bottom: 16px;
  border-radius: 8px;
  font-size: 14px;
}

.alert {
  color: #9c2f22;
  background: #fff0ed;
  border: 1px solid rgba(156, 47, 34, 0.18);
}

.save-message {
  color: #123c36;
  background: #edf7f2;
  border: 1px solid rgba(18, 60, 54, 0.14);
}

@media (max-width: 760px) {
  .admin-page {
    padding: 14px;
  }

  .topbar,
  .top-actions,
  .content-grid,
  .stats-grid,
  .form-grid,
  .runtime-grid,
  .prompt-summary-grid,
  .preview-grid,
  .persona-grid,
  .model-head,
  .inline-head {
    display: flex;
    flex-direction: column;
  }

  .table-row {
    grid-template-columns: minmax(0, 1fr) 72px 52px 66px;
    gap: 8px;
    font-size: 12px;
  }

  .field.wide {
    grid-column: auto;
  }

  .model-actions {
    justify-content: flex-start;
  }

  .current-user-card {
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
  }
}

/* ===== CAMPUS POP V2 ===== */
.v2-mode { background: var(--app-bg, #FFFDF5) !important; min-height: 100vh; padding: 18rpx; }

.mode-toggles { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }

.feedback-list { display: flex; flex-direction: column; gap: 12px; }
.feedback-item { padding: 16px; border: 1px solid rgba(23, 35, 31, 0.1); border-radius: 8px; background: #fbfdfb; }
.feedback-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.feedback-time { color: #68766f; font-size: 13px; }
.feedback-contact { color: #42524b; font-size: 13px; }
.feedback-content { display: block; color: #17231f; font-size: 15px; line-height: 1.6; white-space: pre-wrap; }
.feedback-item.resolved { opacity: 0.7; background: #f4f8f5; }
.feedback-user { color: #68766f; font-size: 12px; margin-left: 12px; }
.feedback-resolved-badge { display: inline-block; margin-top: 10px; padding: 4px 10px; border-radius: 4px; background: #e6f4ec; color: #0f6b45; font-size: 13px; font-weight: 700; }
.feedback-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(23,35,31,0.08); }
.reward-input { width: 140px; height: 34px; padding: 0 10px; border: 1px solid rgba(23,35,31,0.18); border-radius: 6px; font-size: 13px; }

/* custom pet requests */
.pet-request-list { display: flex; flex-direction: column; gap: 12px; }
.pet-request-item { padding: 16px; border: 1px solid rgba(23,35,31,0.12); border-radius: 8px; background: #fff; }
.pet-request-item.delivered { opacity: 0.7; background: #f6f9f6; }
.pet-request-item.rejected { opacity: 0.5; background: #fef5f5; }
.pet-request-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.pet-request-nickname { display: block; font-size: 17px; font-weight: 700; color: #17231f; }
.pet-request-user { font-size: 12px; color: #68766f; margin-left: 10px; }
.pet-request-time { display: block; font-size: 12px; color: #9ea7a3; margin-top: 2px; }
.pet-request-status { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; }
.pet-request-status.pending { background: #fff8e1; color: #b45309; }
.pet-request-status.in_progress { background: #e3f2fd; color: #1e40af; }
.pet-request-status.delivered { background: #e6f4ec; color: #0f6b45; }
.pet-request-status.rejected { background: #fde8e8; color: #c62828; }
.pet-request-desc { display: block; font-size: 14px; color: #444; line-height: 1.6; margin-bottom: 8px; }
.pet-request-images { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.pet-request-img { width: 100px; height: 100px; border-radius: 6px; border: 1px solid rgba(23,35,31,0.12); }
.pet-request-note { margin-top: 6px; font-size: 13px; color: #68766f; }
.pet-request-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(23,35,31,0.08); }

/* Order detail */
.order-detail { padding: 16px; margin-top: 8px; background: #fbfdfb; border-radius: 8px; border: 1px solid rgba(23,35,31,0.08); }
.order-detail-grid { display: flex; flex-direction: column; gap: 6px; font-size: 34rpx; color: #555; }
.pet-request-petid-input { width: 200px; height: 34px; padding: 0 10px; border: 1px solid rgba(23,35,31,0.18); border-radius: 6px; font-size: 13px; }
.plan-tag { font-size: 24rpx; font-weight: 800; padding: 4rpx 12rpx; display: inline-block; }
.plan-tag.plan-trial { background: #4ECDC4; color: #fff; }
.plan-tag.plan-pro { background: #111; color: #FFD93D; }
.plan-tag.plan-ultra { background: #111; color: #FFD93D; }
.plan-tag.plan-free { color: #999; }
</style>
