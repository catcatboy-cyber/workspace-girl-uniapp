<template>
  <view class="admin-page v2-mode">
    <view class="admin-shell">
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
          <text class="stat-label">关系对象</text>
          <text class="stat-value">{{ stats.caseCount }}</text>
        </view>
        <view class="stat-card">
          <text class="stat-label">AI 状态</text>
          <text class="stat-value">{{ stats.aiEnabled ? '已启用' : '未启用' }}</text>
        </view>
      </view>

      <view class="tabs">
        <button :class="['tab-btn', activeTab === 'users' ? 'active' : '']" @click="activeTab = 'users'">用户管理</button>
        <button :class="['tab-btn', activeTab === 'ai' ? 'active' : '']" @click="activeTab = 'ai'">AI 设置</button>
        <button :class="['tab-btn', activeTab === 'billing' ? 'active' : '']" @click="activeTab = 'billing'">Token 额度</button>
        <button :class="['tab-btn', activeTab === 'feedback' ? 'active' : '']" @click="switchToFeedback">反馈管理</button>
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
              <text>对象</text>
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
          <view v-else-if="!selectedDetail" class="empty">选择左侧用户查看关系对象和记录概况。</view>
          <view v-else>
            <view class="detail-line">
              <text class="detail-label">用户 ID</text>
              <text class="detail-value mono">{{ selectedDetail.user.id }}</text>
            </view>
            <view class="detail-line">
              <text class="detail-label">注册时间</text>
              <text class="detail-value">{{ formatDate(selectedDetail.user.createdAt) }}</text>
            </view>
            <view class="case-list">
              <view v-for="item in selectedDetail.cases" :key="item.id" class="case-item">
                <view>
                  <text class="case-name">{{ item.name }}</text>
                  <text class="case-meta">{{ formatDate(item.updatedAt || item.createdAt) }}</text>
                </view>
                <view class="case-counts">
                  <text>{{ item.assessmentCount }} 次评估</text>
                  <text>{{ item.timelineCount }} 条记录</text>
                </view>
              </view>
              <view v-if="selectedDetail.cases.length === 0" class="empty">暂无关系对象。</view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="activeTab === 'ai'" class="panel">
        <view class="panel-head">
          <view>
            <text class="panel-title">全局 AI 设置</text>
            <text class="panel-meta">支持多模型配置，默认模型会被时间线 AI 研判优先使用。</text>
          </view>
          <button class="ghost-btn wide-btn" @click="addModel">添加模型</button>
        </view>

        <view class="switch-row">
          <view>
            <text class="field-title">启用 AI 事件研判</text>
            <text class="field-desc">关闭后前台会回退到规则分析。</text>
          </view>
          <switch :checked="aiForm.aiEnabled" @change="onAIEnabledChange" />
        </view>

        <view class="switch-row">
          <view>
            <text class="field-title">AI 失败时回退规则</text>
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
              <input v-model="model.name" placeholder="例如：GPT-4o" />
            </view>
            <view class="field">
              <text>供应商</text>
              <input v-model="model.provider" placeholder="openai-compatible" />
            </view>
            <view class="field wide">
              <text>Base URL</text>
              <input v-model="model.baseUrl" placeholder="https://api.openai.com/v1" />
            </view>
            <view class="field">
              <text>模型名</text>
              <input v-model="model.model" placeholder="gpt-4o-mini" />
            </view>
            <view class="field">
              <text>API Key</text>
              <input v-model="model.apiKey" password placeholder="留空则沿用已保存密钥" />
            </view>
          </view>

          <view class="model-foot">
            <text v-if="model.hasApiKey && !model.apiKey" class="hint">已保存密钥；留空保存时会继续沿用旧密钥。</text>
            <text v-if="model.testMessage" :class="['test-result', model.testOk ? 'pass' : 'fail']">{{ model.testMessage }}</text>
          </view>
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
                <text>关系对象 Case（决定最近 3 次事件上下文）</text>
                <picker
                  v-if="promptPreviewCaseOptions.length > 0"
                  :range="promptPreviewCaseOptions"
                  range-key="name"
                  :value="Math.max(0, promptPreviewCaseOptions.findIndex((item: any) => item.id === promptPreviewCaseId))"
                  @change="onPromptPreviewCaseChange"
                >
                  <view class="picker-like">
                    {{ promptPreviewCaseOptions.find((item: any) => item.id === promptPreviewCaseId)?.name || '请选择关系对象' }}
                  </view>
                </picker>
                <view v-else class="picker-like muted-box">
                  当前账号下暂无可选关系对象
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
                  <text class="panel-meta">{{ promptMetaFor(module.key).description || '当前 AI 调用模块' }}</text>
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
            <text class="section-title">AI 陪伴风格模板</text>
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

      <view v-if="activeTab === 'billing'" class="panel">
        <view class="panel-head">
          <view>
            <text class="panel-title">Token 额度配置</text>
            <text class="panel-meta">管理首次赠送、充值档位、模型扣费倍率等计费规则。</text>
          </view>
        </view>

        <view class="switch-row">
          <view>
            <text class="field-title">首次赠送额度</text>
            <text class="field-desc">新用户注册后自动赠送。关闭则不再赠送。</text>
          </view>
          <switch :checked="billingForm.firstGiftEnabled" @change="onFirstGiftEnabledChange" />
        </view>
        <view v-if="billingForm.firstGiftEnabled" class="field">
          <text>赠送额度 (token)</text>
          <input v-model.number="billingForm.welcomeTokens" type="number" placeholder="1000000" />
        </view>

        <view class="field">
          <text>1 元兑换额度 (token)</text>
          <input v-model.number="billingForm.tokensPerYuan" type="number" placeholder="100000" />
        </view>

        <view class="settings-section">
          <view class="section-head">
            <text class="section-title">充值档位</text>
            <button class="small-btn" @click="addRechargeTier">添加档位</button>
          </view>
          <view v-for="(tier, index) in rechargeTiers" :key="tier.id" class="model-card">
            <view class="model-head">
              <text class="model-title">{{ tier.name || '未命名档位' }}</text>
              <button class="small-btn danger" @click="removeRechargeTier(index)">删除</button>
            </view>
            <view class="form-grid">
              <view class="field">
                <text>档位 ID</text>
                <input v-model="tier.id" placeholder="p9_9" />
              </view>
              <view class="field">
                <text>名称</text>
                <input v-model="tier.name" placeholder="基础包" />
              </view>
              <view class="field">
                <text>价格 (分)</text>
                <input v-model.number="tier.priceFen" type="number" placeholder="990" />
              </view>
              <view class="field">
                <text>赠送额度</text>
                <input v-model.number="tier.bonusTokens" type="number" placeholder="0" />
              </view>
              <view class="field">
                <text>启用</text>
                <switch :checked="tier.enabled" @change="onTierEnabledChange(index, $event)" />
              </view>
            </view>
          </view>
          <view v-if="rechargeTiers.length === 0" class="empty">暂无充值档位，点击"添加档位"创建。</view>
        </view>

        <view class="settings-section">
          <view class="section-head">
            <text class="section-title">模型扣费倍率</text>
            <button class="small-btn" @click="addModelPricing">添加模型</button>
          </view>
          <view v-for="(mp, index) in modelPricing" :key="'mp-' + index" class="model-card">
            <view class="model-head">
              <text class="model-title">{{ mp.modelId || '新模型' }}</text>
              <button class="small-btn danger" @click="removeModelPricing(index)">删除</button>
            </view>
            <view class="form-grid">
              <view class="field">
                <text>模型 ID ( * 表示通配)</text>
                <input v-model="mp.modelId" placeholder="* 或 deepseek-chat" />
              </view>
              <view class="field">
                <text>扣费倍率</text>
                <input v-model.number="mp.costMultiplier" type="number" placeholder="1" step="0.01" />
              </view>
              <view class="field">
                <text>启用</text>
                <switch :checked="mp.enabled" @change="onModelPricingEnabledChange(index, $event)" />
              </view>
            </view>
          </view>
          <view v-if="modelPricing.length === 0" class="empty">暂无模型倍率配置，点击"添加模型"创建。</view>
        </view>

        <view class="settings-section">
          <view class="section-head">
            <text class="section-title">扣费策略</text>
          </view>
          <view class="form-grid">
            <view class="field">
              <text>Usage 缺失时的扣费策略</text>
              <view class="mode-toggles">
                <button
                  v-for="opt in noUsageFallbackOptions"
                  :key="opt.value"
                  :class="['small-btn', billingForm.noUsageFallback === opt.value ? 'active' : '']"
                  @click="billingForm.noUsageFallback = opt.value"
                >{{ opt.label }}</button>
              </view>
            </view>
            <view class="field">
              <text>余额不足时</text>
              <view class="mode-toggles">
                <button
                  v-for="opt in insufficientModeOptions"
                  :key="opt.value"
                  :class="['small-btn', billingForm.insufficientBalanceMode === opt.value ? 'active' : '']"
                  @click="billingForm.insufficientBalanceMode = opt.value"
                >{{ opt.label }}</button>
              </view>
            </view>
          </view>
        </view>

        <view v-if="saveMessage" class="save-message">{{ saveMessage }}</view>
        <button class="primary-btn" :disabled="billingSaving" @click="saveBillingSettings">
          {{ billingSaving ? '保存中...' : '保存额度配置' }}
        </button>

        <view class="settings-section" style="margin-top: 24px;">
          <view class="section-head">
            <text class="section-title">手动充值</text>
            <text class="section-desc">管理员直接给指定用户增减额度。正数充值，负数扣减（测试用）。</text>
          </view>
          <view class="form-grid">
            <view class="field">
              <text>目标用户 ID</text>
              <input v-model="manualRechargeUserId" placeholder="填写用户的 _id" />
            </view>
            <view class="field">
              <text>充值额度 (token)</text>
              <input v-model.number="manualRechargeAmount" type="number" placeholder="例如 500000" />
            </view>
            <view class="field wide">
              <text>备注</text>
              <input v-model="manualRechargeRemark" placeholder="管理员手动充值" />
            </view>
          </view>
          <button class="primary-btn" :disabled="manualRecharging" @click="doManualRecharge" style="margin-top: 12px;">
            {{ manualRecharging ? '充值中...' : '确认充值' }}
          </button>
          <text v-if="manualRechargeMsg" class="save-message" style="margin-top: 8px;">{{ manualRechargeMsg }}</text>
        </view>
      </view>

      <view v-if="activeTab === 'feedback'" class="panel">
        <view class="panel-head">
          <view>
            <text class="panel-title">用户反馈</text>
            <text class="panel-meta">{{ feedbacks.length }} 条反馈</text>
          </view>
          <button class="ghost-btn wide-btn" :disabled="feedbackLoading" @click="loadFeedbacks">{{ feedbackLoading ? '加载中' : '刷新' }}</button>
        </view>
        <view v-if="feedbacks.length === 0 && !feedbackLoading" class="empty">暂无用户反馈。</view>
        <view v-else class="feedback-list">
          <view v-for="(fb, index) in feedbacks" :key="fb._id || index" class="feedback-item" :class="{ resolved: fb.resolved }">
            <view class="feedback-head">
              <view>
                <text class="feedback-time">{{ formatDate(fb.createdAt) }}</text>
                <text class="feedback-user">用户：{{ fb.userId || fb.openid || '未知' }}</text>
              </view>
              <text v-if="fb.contact" class="feedback-contact">{{ fb.contact }}</text>
            </view>
            <text class="feedback-content">{{ fb.content }}</text>
            <view v-if="fb.resolved" class="feedback-resolved-badge">已采纳 · 奖励 {{ fb.rewardTokens || 0 }} token</view>
            <view v-else class="feedback-actions">
              <input v-if="!fb.userId" :value="targetUserIds[fb._id] || ''" class="reward-input" placeholder="用户ID" @input="onTargetUserInput(fb._id, $event)" />
              <input :value="rewardInputs[fb._id] || ''" type="number" class="reward-input" placeholder="奖励 token" @input="onRewardInput(fb._id, $event)" />
              <button class="small-btn" :disabled="resolvingId === fb._id" @click="resolveFeedback(fb._id)">{{ resolvingId === fb._id ? '处理中' : '采纳' }}</button>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  adminGetOverview,
  adminGetUserDetail,
  adminPreviewPrompt,
  adminUpdateAISettings,
  adminGetBillingSettings,
  adminUpdateBillingSettings,
  adminManualRecharge,
  adminGetTokenLedger,
  adminListFeedbacks,
  adminResolveFeedback,
  getCurrentUserId,
  logout,
  testAIConnection
} from '@/utils/api'

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
    createdAt: string
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
const personaStyleKeys = ['gentle_bestie', 'calm_strategist', 'playful_flirty', 'direct_sharp', 'careful_guardian']
const personaBoldnessKeys = ['conservative', 'balanced', 'bold']

const promptModuleTitles: Record<string, string> = {
  eventAssessment: '即时反馈',
  eventUnderstanding: '事件理解',
  weeklyReview: '本周复盘',
  sideRead: '侧写',
  attachmentAnalysis: '附件识别'
}

const personaStyleTitles: Record<string, string> = {
  gentle_bestie: '温柔闺蜜',
  calm_strategist: '冷静军师',
  playful_flirty: '轻松暧昧',
  direct_sharp: '直接犀利',
  careful_guardian: '谨慎守护'
}

const personaBoldnessTitles: Record<string, string> = {
  conservative: '保守',
  balanced: '平衡',
  bold: '大胆'
}

const runtimeFields = [
  { key: 'eventContextLimit', label: '事件上下文条数', fallback: 3 },
  { key: 'weeklyEventLimit', label: '周复盘事件条数', fallback: 10 },
  { key: 'weeklySideEventLimit', label: '周侧写事件条数', fallback: 6 },
  { key: 'eventMaxTokens', label: '即时反馈 Max Tokens', fallback: 650 },
  { key: 'eventUnderstandingMaxTokens', label: '事件理解 Max Tokens', fallback: 260 },
  { key: 'eventUnderstandingTemperature', label: '事件理解温度', fallback: 0.1 },
  { key: 'weeklyMaxTokens', label: '周复盘 Max Tokens', fallback: 650 },
  { key: 'sideReadMaxTokens', label: '侧写 Max Tokens', fallback: 550 },
  { key: 'attachmentMaxTokens', label: '附件识别 Max Tokens', fallback: 1200 },
  { key: 'eventTemperature', label: '即时反馈温度', fallback: 0.2 },
  { key: 'weeklyTemperature', label: '周复盘温度', fallback: 0.25 },
  { key: 'sideReadTemperature', label: '侧写温度', fallback: 0.35 },
  { key: 'attachmentTemperature', label: '附件温度', fallback: 0.1 }
]

const activeTab = ref<'users' | 'ai' | 'billing' | 'feedback'>('users')
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
const personaConfig = reactive<PersonaConfig>(createEmptyPersonaConfig())
const billingLoading = ref(false)
const billingSaving = ref(false)
const billingForm = reactive({
  firstGiftEnabled: true,
  welcomeTokens: 1000000,
  tokensPerYuan: 100000,
  insufficientBalanceMode: 'block',
  noUsageFallback: 'zero'
})
const rechargeTiers = ref<Array<{ id: string; name: string; priceFen: number; bonusTokens: number; enabled: boolean }>>([])
const modelPricing = ref<Array<{ modelId: string; costMultiplier: number; enabled: boolean }>>([])
const noUsageFallbackOptions = [
  { value: 'zero', label: '不扣费' },
  { value: 'fallback', label: '按 maxTokens 估算' },
  { value: 'fixed', label: '按固定额度' }
]
const insufficientModeOptions = [
  { value: 'block', label: '阻断调用' },
  { value: 'allow', label: '允许欠费' }
]

const manualRechargeUserId = ref('')
const manualRechargeAmount = ref(0)
const manualRechargeRemark = ref('')
const manualRecharging = ref(false)
const manualRechargeMsg = ref('')

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
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
    hasApiKey: false
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
    provider: raw?.provider || 'openai-compatible',
    baseUrl: raw?.baseUrl || 'https://api.openai.com/v1',
    model: raw?.model || 'gpt-4o-mini',
    apiKey: '',
    hasApiKey: Boolean(raw?.hasApiKey || raw?.apiKey)
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
  applyPersonaConfig(settings.personaConfig)
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
  detailLoading.value = true
  errorMessage.value = ''
  try {
    const result = await adminGetUserDetail(userId)
    if (result?.success) {
      selectedDetail.value = result
      promptPreviewCaseId.value = result.cases?.[0]?.id || ''
    } else {
      errorMessage.value = result?.message || '用户详情读取失败'
    }
  } catch (error: any) {
    errorMessage.value = error?.message || '用户详情读取失败'
  } finally {
    detailLoading.value = false
  }
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
    promptPreviewMessage.value = '请先选择一个关系对象'
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
    provider: model.provider || 'openai-compatible',
    baseUrl: model.baseUrl || 'https://api.openai.com/v1',
    model: model.model || 'gpt-4o-mini',
    apiKey: model.apiKey || ''
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
      personaConfig: buildPersonaConfigPayload(),
      runtimeConfig
    })
    if (!result?.success) {
      errorMessage.value = result?.message || 'AI 设置保存失败'
      return
    }
    saveMessage.value = 'AI 设置已保存'
    await refresh()
  } catch (error: any) {
    errorMessage.value = error?.message || 'AI 设置保存失败'
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

function onFirstGiftEnabledChange(event: any) {
  billingForm.firstGiftEnabled = Boolean(event.detail?.value)
}

function onTierEnabledChange(index: number, event: any) {
  const val = event?.detail?.value
  if (rechargeTiers.value[index]) rechargeTiers.value[index].enabled = Boolean(val)
}

function onModelPricingEnabledChange(index: number, event: any) {
  const val = event?.detail?.value
  if (modelPricing.value[index]) modelPricing.value[index].enabled = Boolean(val)
}

async function loadBillingSettings() {
  if (billingLoading.value) return
  billingLoading.value = true
  try {
    const result = await adminGetBillingSettings()
    if (!result?.success) return
    const b = result.billing || {}
    billingForm.firstGiftEnabled = b.firstGiftEnabled !== false
    billingForm.welcomeTokens = Number(b.welcomeTokens ?? 1000000)
    billingForm.tokensPerYuan = Number(b.tokensPerYuan ?? 100000)
    billingForm.insufficientBalanceMode = b.insufficientBalanceMode || 'block'
    billingForm.noUsageFallback = b.noUsageFallback || 'zero'
    rechargeTiers.value = Array.isArray(b.rechargeTiers)
      ? b.rechargeTiers.map((t: any) => ({
          id: t.id || '',
          name: t.name || '',
          priceFen: Number(t.priceFen ?? 990),
          bonusTokens: Number(t.bonusTokens ?? 0),
          enabled: t.enabled !== false
        }))
      : []
    modelPricing.value = Array.isArray(b.modelPricing)
      ? b.modelPricing.map((m: any) => ({
          modelId: m.modelId || '*',
          costMultiplier: Number(m.costMultiplier ?? 1),
          enabled: m.enabled !== false
        }))
      : []
  } catch (e: any) {
    // silently fail on load error
  } finally {
    billingLoading.value = false
  }
}

async function saveBillingSettings() {
  billingSaving.value = true
  saveMessage.value = ''
  errorMessage.value = ''
  try {
    const result = await adminUpdateBillingSettings({
      firstGiftEnabled: billingForm.firstGiftEnabled,
      welcomeTokens: billingForm.welcomeTokens,
      tokensPerYuan: billingForm.tokensPerYuan,
      rechargeTiers: rechargeTiers.value,
      modelPricing: modelPricing.value,
      insufficientBalanceMode: billingForm.insufficientBalanceMode,
      noUsageFallback: billingForm.noUsageFallback
    })
    if (!result?.success) {
      errorMessage.value = result?.message || '额度配置保存失败'
      return
    }
    saveMessage.value = '额度配置已保存'
    await loadBillingSettings()
  } catch (error: any) {
    errorMessage.value = error?.message || '额度配置保存失败'
  } finally {
    billingSaving.value = false
  }
}

function addRechargeTier() {
  const nextId = 'p_' + Date.now()
  rechargeTiers.value.push({
    id: nextId,
    name: '',
    priceFen: 990,
    bonusTokens: 0,
    enabled: true
  })
}

function removeRechargeTier(index: number) {
  rechargeTiers.value.splice(index, 1)
}

function addModelPricing() {
  modelPricing.value.push({
    modelId: '',
    costMultiplier: 1,
    enabled: true
  })
}

function removeModelPricing(index: number) {
  modelPricing.value.splice(index, 1)
}

watch(activeTab, (tab) => {
  if (tab === 'billing' && rechargeTiers.value.length === 0 && modelPricing.value.length === 0) {
    loadBillingSettings()
  }
})

async function doManualRecharge() {
  const uid = manualRechargeUserId.value.trim()
  if (!uid) { manualRechargeMsg.value = '请输入目标用户 ID'; return }
  if (!manualRechargeAmount.value || manualRechargeAmount.value === 0) { manualRechargeMsg.value = '请输入有效额度（正数充值，负数扣减）'; return }
  manualRecharging.value = true
  manualRechargeMsg.value = ''
  try {
    const result = await adminManualRecharge(uid, manualRechargeAmount.value, manualRechargeRemark.value || undefined)
    if (!result?.success) { manualRechargeMsg.value = result?.message || '充值失败'; return }
    const label = manualRechargeAmount.value > 0 ? '充值成功' : '扣减成功'
    manualRechargeMsg.value = `${label}：${manualRechargeAmount.value.toLocaleString()} token → ${uid}`
    manualRechargeAmount.value = 0
    manualRechargeRemark.value = ''
  } catch (e: any) {
    manualRechargeMsg.value = e?.message || '充值失败'
  } finally {
    manualRecharging.value = false
  }
}

const feedbacks = ref<any[]>([])
const feedbackLoading = ref(false)
const rewardInputs = reactive<Record<string, number>>({})
const targetUserIds = reactive<Record<string, string>>({})
const resolvingId = ref('')

async function switchToFeedback() {
  activeTab.value = 'feedback'
  if (feedbacks.value.length === 0) await loadFeedbacks()
}

async function loadFeedbacks() {
  feedbackLoading.value = true
  try {
    const result = await adminListFeedbacks()
    if (result?.success) feedbacks.value = result.feedbacks || []
  } catch { /* ignore */ }
  finally { feedbackLoading.value = false }
}

function onRewardInput(feedbackId: string, e: any) {
  rewardInputs[feedbackId] = Number(e?.detail?.value) || 0
}

function onTargetUserInput(feedbackId: string, e: any) {
  targetUserIds[feedbackId] = String(e?.detail?.value || '').trim()
}

async function resolveFeedback(feedbackId: string) {
  if (!feedbackId || resolvingId.value) return
  const tokens = Number(rewardInputs[feedbackId]) || 0
  if (tokens <= 0) { errorMessage.value = '奖励 token 必须大于 0'; return }
  errorMessage.value = ''
  resolvingId.value = feedbackId
  try {
    const result = await adminResolveFeedback(feedbackId, tokens, targetUserIds[feedbackId] || undefined)
    if (result?.success) {
      const fb = feedbacks.value.find((f: any) => f._id === feedbackId)
      if (fb) { fb.resolved = true; fb.rewardTokens = tokens }
    } else {
      errorMessage.value = result?.message || '处理失败'
    }
  } catch (e: any) {
    errorMessage.value = e?.message || '处理失败'
  }
  finally { resolvingId.value = '' }
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
  font-size: 30px;
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
</style>
