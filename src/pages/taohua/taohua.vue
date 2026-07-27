<template>
  <view :class="['page v2-mode', !loading ? 'anim-ready' : '', fontSizeMode === 'large' ? 'font-large' : '']" :style="pageStyle">
    <view v-if="loading" class="loading">LOADING...</view>
    <block v-else>
    <!-- ① Hero -->
    <view class="hero-block-v2 anim-hero">
      <text class="hero-tag-v2">TAOHUA</text>
      <text class="hero-title-v2">今日<text class="hl-v2">桃花</text></text>
      <text class="hero-copy-v2">
        {{ computedReport.今日方位?.['公历日期']?.split(' ')?.[0] || '--' }}
        · {{ computedReport.今日方位?.['农历'] || '--' }}
      </text>
      <hr class="hero-divider">
      <view class="hero-bottom">
        <view class="hero-avatar-lg taohua-score-avatar">
          <text class="taohua-score-main">{{ taohuaScore || '--' }}</text>
          <text class="taohua-score-unit">桃花</text>
        </view>
        <view class="hero-info-col">
          <view class="hero-main-row">
            <view class="hero-main-left">
              <text class="hero-name-v2">今日桃花指数</text>
              <text :class="['hero-chip', isLowTaohuaScore ? 'muted' : 'primary']">{{ isLowTaohuaScore ? '慢热' : '可行动' }}</text>
            </view>
          </view>
          <view class="hero-meta-row">
            <text class="hero-chip">桃花 {{ dailyTaohuaDir }}</text>
            <text class="hero-chip">日柱 {{ computedReport.今日方位?.['日柱'] || '--' }}</text>
            <text class="hero-chip">建除 {{ computedReport.今日宜忌?.['建除'] || '--' }}</text>
            <text class="hero-chip">星宿 {{ (computedReport.今日方位?.['二十八宿'] || '').split('（')[0] || '--' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ② 今日桃花罗盘 -->
    <view class="card-v2">
      <text class="section-title-v2">今日桃花方位</text>

      <TaohuaCompass
        :direction="dailyTaohuaDir"
        :directionZhi="dailyTaohuaZhi"
      />

      <text class="card-text-v2 strong">
        今日咸池桃花在{{ dailyTaohuaDir }}（{{ dailyTaohuaZhi }}位），属{{ dailyTaohuaWuxing }}
      </text>
      <text class="card-text-v2 muted">
        {{ computedReport.流日桃花?.['principle'] || '' }}
      </text>
      <text class="card-text-v2 muted caption-note-v2">方位以你当前位置为中心</text>

      <!-- 4 列方位条 -->
      <view class="dir-strip-v2">
        <view class="dir-cell-v2">
          <text class="dir-lbl-v2">喜神</text>
          <text class="dir-val-v2">{{ computedReport.今日方位?.['喜神']?.['方位'] || '--' }}</text>
        </view>
        <view class="dir-cell-v2">
          <text class="dir-lbl-v2">财神</text>
          <text class="dir-val-v2">{{ computedReport.今日方位?.['财神']?.['方位'] || '--' }}</text>
        </view>
        <view class="dir-cell-v2">
          <text class="dir-lbl-v2">福神</text>
          <text class="dir-val-v2">{{ computedReport.今日方位?.['福神']?.['方位'] || '--' }}</text>
        </view>
        <view class="dir-cell-v2">
          <text class="dir-lbl-v2">阳贵</text>
          <text class="dir-val-v2">{{ computedReport.今日方位?.['阳贵']?.['方位'] || '--' }}</text>
        </view>
      </view>

      <!-- 出处 -->
      <view class="cite-block-v2">
        <view class="inline-title-v2">
          <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(28)" :src="taohuaIcon('bookOpen')" mode="aspectFit" />
          <text v-else class="taohua-icon-emoji">📖</text>
          <text class="cite-title-v2">出处</text>
        </view>
        <text class="cite-desc-v2">咸池桃花：《三命通会》三合沐浴算法 · 神煞方位：《协纪辨方书》卷二十 · 日历：寿星天文历</text>
      </view>
    </view>

    <!-- ③ 今日行动指南 -->
    <view v-if="computedReport.今日行动指南" class="card-v2 action-guide-card-v2">
      <view class="section-title-row-v2">
        <text class="section-title-v2 no-margin">今日行动指南</text>
        <text class="info-dot-v2" @click="showGuideInfo = true">ⓘ</text>
      </view>
      <view v-if="showGuideInfo" class="info-overlay" @click="showGuideInfo = false">
        <view class="info-sheet" @click.stop>
          <view class="info-sheet-head">
            <text class="info-sheet-title">方位决策指南</text>
            <text class="info-sheet-close" @click="showGuideInfo = false">×</text>
          </view>
          <view class="info-sheet-body">
            <view class="info-tree-item"><text class="info-tree-q">只是想约TA、制造暧昧、日常碰面？</text><text class="info-tree-a">→ 看 🪷 桃花位（当日气场，管邂逅）</text></view>
            <view class="info-tree-item"><text class="info-tree-q">准备告白 / 确定关系 / 见家长？</text><text class="info-tree-a">→ 看 🔴 红鸾位（本命位，管姻缘开端）</text></view>
            <view class="info-tree-item"><text class="info-tree-q">求婚 / 订婚 / 结婚 / 备孕？</text><text class="info-tree-a">→ 看 🕊️ 天喜位（本命位，管婚庆落地）</text></view>
            <view class="info-tree-divider"></view>
            <view class="info-tree-item"><text class="info-tree-q">今日桃花与六合助缘重叠 🔥？</text><text class="info-tree-a">→ 能量加乘，适合安排轻量约会和推进互动</text></view>
            <view class="info-tree-divider"></view>
            <text class="info-tree-note">💡 核心：按你要的结果选对应的煞。日常暧昧不需要天喜，求婚不需要桃花。各管各的，不互相替代。</text>
          </view>
        </view>
      </view>

      <view class="action-guide-hero-v2">
        <view class="action-guide-main-v2 emoji-mix-v2"><block v-for="(seg, si) in guideMainSegs" :key="si"><image v-if="seg.type === 'icon'" class="emoji-icon-v2" :src="seg.src" mode="aspectFit" /><text v-else>{{ seg.value }}</text></block></view>
        <view v-if="computedReport.桃花指数" class="action-score-v2">
          <view class="action-score-head-v2">
            <text class="score-num-v2">{{ computedReport.桃花指数?.分数 || '--' }}</text>
            <text class="score-unit-v2">/100</text>
          </view>
          <view class="score-track-v2">
            <view class="score-fill-v2" :style="{ width: (computedReport.桃花指数?.分数 || 50) + '%' }"></view>
          </view>
          <view v-if="computedReport.桃花指数?.一句话" class="action-score-note-v2 emoji-mix-v2"><block v-for="(seg, si) in scoreNoteSegs" :key="si"><image v-if="seg.type === 'icon'" class="emoji-icon-v2" :src="seg.src" mode="aspectFit" /><text v-else>{{ seg.value }}</text></block></view>
        </view>
        <view v-if="(computedReport.桃花指数?.加分项 || []).some((r:string)=>r.includes('六合') || r.includes('天喜'))" class="action-boost-v2">
          <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(20)" :src="taohuaIcon('sparkles')" mode="aspectFit" />
          <text v-else class="taohua-icon-emoji">🔥</text>
          <text>六合助缘<text v-if="guideLiuheDir"> · {{ guideLiuheDir }}</text></text>
        </view>
      </view>

      <view class="action-guide-section-v2">
        <view class="action-guide-section-title-v2">
          <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(24)" :src="taohuaIcon('compass')" mode="aspectFit" />
          <text v-else class="taohua-icon-emoji">🧭</text>
          <text>方位怎么用</text>
        </view>
        <view class="action-guide-body-v2">
        <view class="action-dir-grid-v2">
          <view class="action-dir-card-v2">
            <text class="action-dir-name-v2">今日桃花</text>
            <text class="action-dir-value-v2">{{ guideDirection }}</text>
            <text class="action-dir-use-v2">日常暧昧 / 约见</text>
          </view>
          <view class="action-dir-card-v2">
            <text class="action-dir-name-v2">本命红鸾</text>
            <text class="action-dir-value-v2 hongluan">{{ natalHongluanDir || '--' }}</text>
            <text class="action-dir-use-v2">告白 / 确认关系</text>
          </view>
          <view class="action-dir-card-v2">
            <text class="action-dir-name-v2">本命天喜</text>
            <text class="action-dir-value-v2 tianxi">{{ natalTianxiDir || '--' }}</text>
            <text class="action-dir-use-v2">正式推进 / 落地</text>
          </view>
        </view>
        <view class="action-vibe-v2">
          <text class="action-vibe-label-v2">今日气场</text>
          <view class="action-vibe-text-v2 emoji-mix-v2"><block v-for="(seg, si) in vibeSegs" :key="si"><image v-if="seg.type === 'icon'" class="emoji-icon-v2" :src="seg.src" mode="aspectFit" /><text v-else>{{ seg.value }}</text></block></view>
        </view>
        <text class="cite-inline-v2">《协纪辨方书》《三命通会》</text>
        </view>
      </view>

      <view class="action-guide-section-v2">
        <view class="action-guide-section-title-v2">
          <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(24)" :src="taohuaIcon('target')" mode="aspectFit" />
          <text v-else class="taohua-icon-emoji">🎯</text>
          <text>今天怎么做</text>
        </view>
        <view class="action-guide-body-v2">
        <view v-if="(guideActivities || []).length > 0" class="action-tag-row-v2">
          <view v-for="(a, i) in guideActivities" :key="'act-'+i" class="tag-v2 green tag-with-icon-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(18)" :src="taohuaIcon('target')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">🎯</text>
            <text>{{ a }}</text>
          </view>
        </view>
        <view class="action-line-list-v2">
          <view v-for="(a, i) in guideDos" :key="'do-'+i" class="action-guide-line-v2 good">
            <text class="action-guide-pill-v2">宜</text>
            <text class="action-guide-line-text-v2">{{ a }}</text>
          </view>
          <view v-for="(a, i) in guideDonts" :key="'dont-'+i" class="action-guide-line-v2 warn">
            <text class="action-guide-pill-v2 warn">避开</text>
            <text class="action-guide-line-text-v2">{{ a }}</text>
          </view>
        </view>
        </view>
      </view>

      <view class="action-guide-section-v2" v-if="computedReport.今日行动指南?.穿戴建议">
        <view class="action-guide-section-title-v2">
          <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(24)" :src="taohuaIcon('shirt')" mode="aspectFit" />
          <text v-else class="taohua-icon-emoji">👗</text>
          <text>穿什么戴什么</text>
          <text class="cite-inline-v2">《三命通会》</text>
        </view>
        <view class="action-guide-body-v2">
        <text class="action-wear-main-v2">{{ computedReport.今日行动指南?.穿戴建议?.一句话 || '' }}</text>
        <view class="action-tag-row-v2">
          <text v-for="c in computedReport.今日行动指南?.穿戴建议?.桃花颜色 || []" :key="c" class="tag-v2">{{ c }}</text>
          <text class="tag-v2 black">{{ computedReport.今日行动指南?.穿戴建议?.桃花材质 || '' }}</text>
        </view>
        <text v-if="computedReport.今日行动指南?.穿戴建议?.五行关系" class="action-wear-note-v2">
            桃花{{ computedReport.今日行动指南?.穿戴建议?.桃花五行 || '' }} · 本命{{ computedReport.今日行动指南?.穿戴建议?.本命五行 || '' }} → {{ computedReport.今日行动指南?.穿戴建议?.五行关系 || '' }}
        </text>
        </view>
      </view>
    </view>

    <!-- ④ 桃花人设（依赖画像） -->
    <view v-if="hasProfile" class="card-v2">
      <view class="section-title-row-v2 persona-title-row-v2">
        <text class="section-title-v2 no-margin">你的桃花人设</text>
        <view class="persona-share-action-v2" @click="sharePersona">
          <image class="taohua-icon-img" :style="iconStyle(22)" :src="taohuaIcon('share2')" mode="aspectFit" />
        </view>
      </view>

      <view class="persona-card-v2">
        <view class="persona-hero-v2">
          <view class="persona-hero-copy-v2">
            <text class="persona-type-badge-v2">{{ personaTitle }}</text>
            <text class="persona-main-v2">{{ personaDesc }}</text>
            <text class="persona-sub-v2">{{ crossData.chinese.name }} · {{ crossData.chinese.zhi }} · {{ crossData.chinese.wuxing }} · {{ crossData.chinese.yinyang }}</text>
          </view>
          <view class="persona-avatar-stack-v2">
            <image v-if="zodiacSvg" class="persona-avatar-icon-v2" :src="zodiacSvg" mode="aspectFit" />
            <image v-if="signEmojiSvg" class="persona-avatar-icon-v2" :src="signEmojiSvg" mode="aspectFit" />
          </view>
        </view>

        <view class="persona-identity-strip-v2">
          <view class="persona-identity-item-v2">
            <image v-if="zodiacSvg" class="persona-identity-symbol-icon-v2" :src="zodiacSvg" mode="aspectFit" />
            <view class="persona-identity-copy-v2">
              <text class="persona-identity-label-v2">我的生肖</text>
              <text class="persona-identity-value-v2">{{ userZodiac }}</text>
            </view>
          </view>
          <view class="persona-identity-item-v2 alt">
            <image v-if="signEmojiSvg" class="persona-identity-symbol-icon-v2" :src="signEmojiSvg" mode="aspectFit" />
            <view class="persona-identity-copy-v2">
              <text class="persona-identity-label-v2">我的星座</text>
              <text class="persona-identity-value-v2">{{ userSign }}</text>
            </view>
          </view>
        </view>

        <view class="persona-match-strip-v2">
          <view :class="['persona-match-badge-v2', matchBadgeClass]">{{ crossData.relation }}</view>
          <text class="persona-match-desc-v2">{{ crossData.relationDesc }}</text>
        </view>

        <!-- 中国维度 -->
        <view class="persona-dim-v2">
          <view class="persona-dim-label-v2 label-with-icon-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(20)" :src="taohuaIcon('landmark')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">🌏</text>
            <text>中国星次</text>
          </view>
          <text class="persona-dim-text-v2 strong">{{ chinesePersonaLine }}</text>
          <text class="persona-dim-text-v2">{{ crossData.chinese.character }}</text>
          <text class="persona-dim-src-v2">{{ crossData.chinese.source }}</text>
        </view>

        <!-- 西方维度 -->
        <view class="persona-dim-v2">
          <view class="persona-dim-label-v2 label-with-icon-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(20)" :src="taohuaIcon('stars')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">🌍</text>
            <text>西方星座</text>
          </view>
          <text class="persona-dim-text-v2">{{ crossData.western.planet }}守护 · {{ crossData.western.element }}象{{ crossData.western.mode.split('（')[0] }}</text>
          <text class="persona-dim-text-v2 strong">{{ personaTitle }}</text>
          <text class="persona-dim-src-v2">{{ crossData.western.source }}</text>
        </view>

        <!-- 最佳配对 -->
        <view class="persona-match-tags-v2">
          <text class="persona-match-label-v2">最佳配对</text>
          <view v-for="m in crossData.western.bestMatch" :key="m" class="tag-v2 black tag-with-icon-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(20)" :src="taohuaIcon('heart')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">❤️</text>
            <text>{{ m }}</text>
          </view>
          <text class="persona-match-reason-v2">{{ crossData.western.bestMatchReason }}</text>
        </view>
      </view>
    </view>

    <!-- 画像引导卡（无画像时） -->
    <view v-else class="card-v2 guide-card-v2" @click="goSelfProfile">
      <view class="section-title-row-v2">
        <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(30)" :src="taohuaIcon('lock')" mode="aspectFit" />
        <text v-else class="taohua-icon-emoji">🔒</text>
        <text class="section-title-v2 no-margin">你的桃花人设</text>
      </view>
      <text class="card-text-v2 theme-strong-inline">完善画像后解锁专属桃花分析</text>
      <text class="card-text-v2 muted">填写你的生肖和星座，即可查看中国星次解读、西方星座桃花风格、最佳配对等专属内容。点击前往 →</text>
    </view>

    <!-- 桃花匹配度（绑定 Crush：从「我们」页进入，含 AI 深度解读） -->
    <view v-if="pairMatch" class="card-v2">
      <view class="section-title-row-v2 persona-title-row-v2">
        <text class="section-title-v2 no-margin">桃花匹配度</text>
        <view class="pair-title-actions-v2">
          <view v-if="isPairPreviewing && canRestoreCurrentPair" class="mini-action-v2" @click="restoreCurrentPair">恢复当前 TA</view>
          <view class="persona-share-action-v2 pair-share-action-v2" @click="sharePairMatch">
            <image class="taohua-icon-img" :style="iconStyle(22)" :src="taohuaIcon('share2')" mode="aspectFit" />
          </view>
        </view>
      </view>
      <view class="action-guide-body-v2">
      <view v-if="pairParticipants" class="pair-summary-v2">
        <view class="pair-party-card-v2">
          <text class="pair-role-v2">{{ pairParticipants.selfLabel }}</text>
          <view class="pair-token-v2">
            <image class="pair-token-symbol-icon-v2" :src="getZodiacSvg(pairParticipants.selfZodiac)" mode="aspectFit" />
            <text class="pair-token-text-v2">{{ pairParticipants.selfZodiac }}</text>
          </view>
          <view class="pair-token-v2 alt">
            <text class="pair-token-symbol-v2">{{ getSignEmoji(pairParticipants.selfSign) }}</text>
            <text class="pair-token-text-v2">{{ pairParticipants.selfSign }}</text>
          </view>
        </view>

        <view class="pair-relation-stack-v2">
          <text class="pair-role-v2 pair-role-mid-v2">匹配</text>
          <view :class="['pair-relation-cell-v2', relationToneClass(pairMatch.relation)]">
          <text class="pair-relation-label-v2">生肖</text>
          <text class="pair-relation-value-v2">{{ pairMatch.relation }}</text>
          </view>
          <view :class="['pair-relation-cell-v2', signRelationToneClass(pairMatch.signRelation)]">
          <text class="pair-relation-label-v2">星座</text>
          <text class="pair-relation-value-v2">{{ pairMatch.signRelation || '星座节奏平衡' }}</text>
          </view>
        </view>

        <view class="pair-party-card-v2">
          <text class="pair-role-v2">{{ pairParticipants.partnerLabel }}</text>
          <picker class="pair-token-picker-v2" :range="zodiacNames" :value="currentPairPartnerZodiacIdx" @change="onPreviewPairZodiacChange">
            <view class="pair-token-v2 clickable">
              <image class="pair-token-symbol-icon-v2" :src="getZodiacSvg(pairParticipants.partnerZodiac)" mode="aspectFit" />
              <text class="pair-token-text-v2">{{ pairParticipants.partnerZodiac }}</text>
              <view class="pair-token-edit-v2">
                <image class="taohua-icon-img" :style="iconStyle(16)" :src="taohuaIcon('listChecks')" mode="aspectFit" />
              </view>
            </view>
          </picker>
          <picker class="pair-token-picker-v2" :range="signNames" :value="currentPairPartnerSignIdx" @change="onPreviewPairSignChange">
            <view class="pair-token-v2 alt clickable">
              <text class="pair-token-symbol-v2">{{ getSignEmoji(pairParticipants.partnerSign) }}</text>
              <text class="pair-token-text-v2">{{ pairParticipants.partnerSign }}</text>
              <view class="pair-token-edit-v2">
                <image class="taohua-icon-img" :style="iconStyle(16)" :src="taohuaIcon('listChecks')" mode="aspectFit" />
              </view>
            </view>
          </picker>
        </view>
      </view>
      <text v-if="pairParticipants" class="pair-basis-v2">匹配依据：生肖 + 星座</text>
      <view v-if="(crushMbtiDisplay || crushIdentityDisplay) && !isPairPreviewing" class="pair-extra-tags-v2">
        <text v-if="crushMbtiDisplay" class="pair-extra-tag-v2 mbti">MBTI {{ crushMbtiDisplay }}</text>
        <text v-if="crushIdentityDisplay" class="pair-extra-tag-v2 identity">{{ crushIdentityDisplay }}</text>
      </view>
      <text v-if="isPairPreviewing" class="pair-preview-note-v2">当前是临时预览组合，仅在本页生效，不会修改 TA 档案。</text>
      <text class="pair-summary-desc-v2">{{ pairMatch.combinedRelationDesc || pairMatch.relationDesc }}</text>

      <view v-if="pairInsight" class="pair-insight-v2">
        <view class="pair-section-v2">
          <view class="pair-label-row-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(26)" :src="taohuaIcon('stars')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">💫</text>
            <text class="pair-label-v2">风格碰撞</text>
          </view>
          <text class="pair-text-v2">{{ pairInsight.styleClash }}</text>
        </view>
        <view v-if="(pairInsight.activities || []).length" class="pair-section-v2">
          <view class="pair-label-row-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(26)" :src="taohuaIcon('target')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">🎯</text>
            <text class="pair-label-v2">适合一起</text>
          </view>
          <view v-for="(a, i) in pairInsight.activities.slice(0, 2)" :key="'pa-' + i" class="guide-line-v2 good">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(22)" :src="taohuaIcon('checkCircle')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">✅</text>
            <text class="pair-text-v2 good">{{ a }}</text>
          </view>
        </view>
        <view v-if="(pairInsight.watchOut || []).length" class="pair-section-v2">
          <view class="pair-label-row-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(26)" :src="taohuaIcon('alertTriangle')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">⚠️</text>
            <text class="pair-label-v2">当心</text>
          </view>
          <view v-for="(w, i) in pairInsight.watchOut.slice(0, 2)" :key="'pw-' + i" class="guide-line-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(22)" :src="taohuaIcon('alertTriangle')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">!</text>
            <text class="pair-text-v2 muted">{{ w }}</text>
          </view>
        </view>
        <view v-if="pairPartnerStyle" class="pair-section-v2">
          <view class="pair-label-row-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(26)" :src="taohuaIcon('sparkles')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">✨</text>
            <text class="pair-label-v2">TA 的桃花风格</text>
          </view>
          <text class="pair-text-v2">{{ pairPartnerStyle }}</text>
        </view>
      </view>

      <button v-if="!isPairPreviewing" class="btn-v2-me primary" style="width:100%;margin-top:16rpx;" :disabled="pairReadLoading" @click="doPairAIDeepRead">{{ pairReadLoading ? '解读中...' : (pairAIResult ? '🔄 重新解读（获取今日最新气场）' : '🔍 深度解读') }}</button>
      <text v-else class="pair-preview-hint-v2">{{ aiLabel() }} 深度解读仍绑定当前 TA。恢复当前 TA 后可继续查看。</text>

      <view v-if="pairReadLoading" class="action-box">
        <text class="action-label">{{ aiLabel() }} 深度解读中...</text>
        <view class="ai-row"><view class="ai-dot"></view><text class="action-text muted">后台分析中，结合今日气场...</text></view>
      </view>
      <view v-if="pairAIResult" class="action-box">
        <text class="action-label">深度解读（{{ pairAIResult.day || '今日' }}日）</text>
        <text v-if="pairAIResult.dayEnergy" class="action-text" user-select>{{ pairAIResult.dayEnergy }}</text>
        <text v-if="pairAIResult.monthTrend" class="action-text" user-select style="margin-top:6rpx;">{{ pairAIResult.monthTrend }}</text>
        <text v-if="pairAIResult.relationshipDynamics" class="action-text" user-select style="margin-top:6rpx;">{{ pairAIResult.relationshipDynamics }}</text>
        <text v-if="pairAIResult.advice" class="action-text advice" user-select>💡 {{ pairAIResult.advice }}</text>
        <text v-if="pairAIResult.message && !pairAIResult.dayEnergy && !pairAIResult.advice" class="action-text muted" user-select>{{ pairAIResult.message }}</text>
      </view>
      </view>
    </view>
    <view v-else-if="showPairReadGuide" class="card-v2" style="border-style:dashed;">
      <view class="section-title-row-v2 persona-title-row-v2">
        <text class="section-title-v2 no-margin">桃花匹配度</text>
        <view v-if="hasProfile" class="mini-action-v2" @click="openMatchSheet">测 TA</view>
      </view>
      <text class="card-text-v2" @click="handlePairGuideClick">完善你和 Crush 的生肖星座，解锁桃花匹配解读 →</text>
    </view>
    <view v-else-if="hasProfile" class="card-v2">
      <view class="section-title-row-v2 persona-title-row-v2">
        <text class="section-title-v2 no-margin">桃花匹配度</text>
        <view class="mini-action-v2" @click="openMatchSheet">测 TA</view>
      </view>
      <text class="card-text-v2 muted no-margin">选择 TA 的属相和星座，查看你们的命理匹配结果。</text>
    </view>

    <!-- ⑥ 桃花方位全览 -->
    <view class="card-v2">
      <text class="section-title-v2">桃花方位全览</text>

      <view class="overview-table-v2">
        <view class="ov-row-v2">
          <text class="ov-label-v2">本命·终身</text>
          <text class="ov-dir-v2">{{ computedReport.本命桃花?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.本命红鸾天喜?.['hongluan']?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.本命红鸾天喜?.['tianxi']?.['direction'] || '--' }}</text>
        </view>
        <view class="ov-row-v2">
          <text class="ov-label-v2">流年</text>
          <text class="ov-dir-v2">{{ computedReport.流年桃花?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.流年红鸾天喜?.['hongluan']?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.流年红鸾天喜?.['tianxi']?.['direction'] || '--' }}</text>
        </view>
        <view class="ov-row-v2">
          <text class="ov-label-v2">流月</text>
          <text class="ov-dir-v2">{{ computedReport.流月桃花?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.流月红鸾天喜?.['hongluan']?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2">{{ computedReport.流月红鸾天喜?.['tianxi']?.['direction'] || '--' }}</text>
        </view>
        <view class="ov-row-v2 current">
          <text class="ov-label-v2">流日·今日</text>
          <text class="ov-dir-v2 current">{{ computedReport.流日桃花?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2 current">{{ computedReport.流日红鸾天喜?.['hongluan']?.['direction'] || '--' }}</text>
          <text class="ov-dir-v2 current">{{ computedReport.流日红鸾天喜?.['tianxi']?.['direction'] || '--' }}</text>
        </view>
      </view>

      <text class="card-text-v2 muted" style="margin-top:12rpx;display:block;">
        本命位终身不变 · 流年/流月/流日为动态推演 · 今日约会优先看今日桃花位
      </text>
    </view>

    <!-- ⑦ 订阅推送 -->
    <!-- ⑧ 免责声明 -->
    <view class="card-v2 disclaimer-card-v2">
      <view class="disclaimer-lines-v2">
        <view class="disclaimer-head-v2">
          <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(24)" :src="taohuaIcon('bookOpen')" mode="aspectFit" />
          <text v-else class="taohua-icon-emoji">📖</text>
          <text class="card-text-v2 muted no-margin">源自传统命理经典，仅供文化娱乐参考</text>
        </view>
        <text class="card-text-v2 muted no-margin">基于今日干支（{{ computedReport.今日方位?.['日柱'] || '--' }}）计算 · 每日自动刷新</text>
        <text class="card-text-v2 muted no-margin">中国传统算法参考《三命通会》《协纪辨方书》</text>
        <text class="card-text-v2 muted no-margin">西方星座参考 Ptolemy《Tetrabiblos》（《占星四书》）</text>
      </view>
    </view>

    <!-- 分享卡预览弹窗 -->
    <view v-if="showSharePreview" class="sheet-mask" @click="showSharePreview = false">
      <view class="sheet-panel" style="text-align:center;" @click.stop>
        <view class="sheet-head-v2">
          <view class="sheet-title-row-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(28)" :src="taohuaIcon('share2')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">📤</text>
            <text class="sheet-title-v2">{{ sharePreviewTitle }}</text>
          </view>
          <view class="sheet-close-v2" @click="showSharePreview = false">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(28)" :src="taohuaIcon('x')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">✕</text>
          </view>
        </view>
        <image v-if="shareImagePath" class="share-preview-image-v2" :src="shareImagePath" mode="widthFix" />
        <view style="display:flex;gap:12rpx;margin-top:20rpx;">
          <button v-if="canSaveShareImage" class="btn-v2-me primary" style="flex:1;" @click="saveShareImage">保存到相册</button>
          <button class="btn-v2-me outline" style="flex:1;" open-type="share">转发给好友</button>
        </view>
      </view>
    </view>

    <!-- 隐藏 Canvas -->
    <canvas type="2d" id="taohuaShareCanvas" style="position:fixed;left:-9999px;top:-9999px;width:640px;height:512px;"></canvas>

    <view class="ai-disclaimer">
      <text class="ai-disclaimer-text">{{ aiLabel() }} 辅助分析 · 仅供辅助参考，不构成专业意见</text>
      <text class="go-home-link" @click="goHome">回到首页</text>
    </view>

    <!-- 配对检查 Bottom Sheet -->
    <view v-if="showMatchSheet" class="sheet-mask" @click="showMatchSheet = false">
      <view class="sheet-panel" @click.stop>
        <view class="sheet-head-v2">
          <view class="sheet-title-row-v2">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(28)" :src="taohuaIcon('search')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">🔍</text>
            <text class="sheet-title-v2">配对检查</text>
          </view>
          <view class="sheet-close-v2" @click="showMatchSheet = false">
            <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(28)" :src="taohuaIcon('x')" mode="aspectFit" />
            <text v-else class="taohua-icon-emoji">✕</text>
          </view>
        </view>

        <view class="picker-stack-v2">
          <picker :range="zodiacNames" :value="matchZodiacIdx" @change="onMatchZodiacChange">
            <view class="picker-card-v2">
              <view class="picker-card-main-v2">
                <text class="picker-label-v2">TA 的生肖</text>
                <text class="picker-value-v2">{{ zodiacNames[matchZodiacIdx] }}</text>
              </view>
              <view class="picker-action-v2">
                <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(20)" :src="taohuaIcon('listChecks')" mode="aspectFit" />
                <text v-else class="taohua-icon-emoji">≡</text>
              </view>
            </view>
          </picker>
          <picker :range="signNames" :value="matchSignIdx" @change="onMatchSignChange">
            <view class="picker-card-v2">
              <view class="picker-card-main-v2">
                <text class="picker-label-v2">TA 的星座</text>
                <text class="picker-value-v2">{{ signNames[matchSignIdx] }}</text>
              </view>
              <view class="picker-action-v2">
                <image v-if="useTaohuaLineIcons" class="taohua-icon-img" :style="iconStyle(20)" :src="taohuaIcon('listChecks')" mode="aspectFit" />
                <text v-else class="taohua-icon-emoji">≡</text>
              </view>
            </view>
          </picker>
        </view>

        <text class="card-text-v2 muted" style="margin-top:12rpx;">仅在当前页面预览新的属相和星座组合，不会修改 TA 档案。</text>
        <view class="sheet-actions-v2">
          <button class="btn-v2-me primary" style="flex:1;" @click="doMatchCheck">按此组合查看</button>
          <button v-if="canRestoreCurrentPair" class="btn-v2-me outline" style="flex:1;" @click="restoreCurrentPairFromSheet">恢复当前 TA</button>
        </view>
      </view>
    </view>
    </block>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import {
  zodiacPairMatch, zodiacSignMatch, zodiacToTaohua, hongluanTianxi, xianchiAlgorithm,
  getTodayStr, ZODIAC_NAMES, SIGN_NAMES, ZODIAC_TO_ZHI,
  generatePairInsight, buildPairMatchPayload, resolveIdentityLabel
} from '@/utils/taohua'
import type { CrossMatchResult, PairInsight } from '@/utils/taohua'
import TaohuaCompass from '@/components/TaohuaCompass.vue'
import { checkFeatureAccess, queryTaohua, getCachedSelfProfile, getCurrentUserId, getCaseDetail, generatePairRead, getSelfProfile } from '@/utils/api'
import { TAOHUA_SHARE_IMAGE, appendReferralParams } from '@/utils/share'
import { applyThemeChrome, getFontSizeMode, getThemeStyle } from '@/utils/theme'
import { bumpDataVersion, getActiveCaseId } from '@/utils/helpers'
import { aiLabel } from '@/utils/labels'
import { getZodiacSvg, getConstellationSvg, parseEmojiText } from '@/utils/zodiac-icons'

// ============================================================
// 用户画像
// ============================================================
const selfProfile = ref<any>(null)
const userZodiac = ref<string>('')
const userSign = ref<string>('')
const fontSizeMode = ref<string>(getFontSizeMode())
const pageStyle = ref<string>(getThemeStyle())
const loading = ref(true)
const dataReady = ref(false)
const lastDataVersion = ref(0)
const useTaohuaLineIcons = true

const taohuaIconMap: Record<string, string> = {
  bookOpen: '/static/icons/taohua/book.svg',
  listChecks: '/static/icons/taohua/clipboard.svg',
  compass: '/static/icons/taohua/compass.svg',
  target: '/static/icons/taohua/target.svg',
  checkCircle: '/static/icons/taohua/check.svg',
  alertTriangle: '/static/icons/taohua/warning.svg',
  shirt: '/static/icons/taohua/shirt.svg',
  landmark: '/static/icons/taohua/landmark.svg',
  stars: '/static/icons/taohua/star-filled.svg',
  heart: '/static/icons/taohua/heart-filled.svg',
  share2: '/static/icons/taohua/share.svg',
  lock: '/static/icons/taohua/lock.svg',
  bell: '/static/icons/taohua/bell.svg',
  search: '/static/icons/taohua/search.svg',
  x: '/static/icons/taohua/cross.svg',
  sparkles: '/static/icons/taohua/fire.svg'
}

function taohuaIcon(name: string) {
  return taohuaIconMap[name] || ''
}

function iconStyle(size: number) {
  return `width:${size}rpx;height:${size}rpx;`
}

function refreshProfile() {
  selfProfile.value = getCachedSelfProfile()
  userZodiac.value = selfProfile.value?.zodiac || ''
  userSign.value = selfProfile.value?.constellation || ''
}
refreshProfile()

// ============================================================
// 首次渲染前预加载缓存 → 避免 LOADING 闪烁
// ============================================================
const dailyData = ref<any>(null)
const practicalData = ref<any>(null)
const scoreData = ref<any>(null)
const reportData = ref<any>(null)

function buildCacheKey() {
  const uid = getCurrentUserId() || 'anon'
  const today = getTodayStr()
  return `taohuaReport:v1:${uid}:${today}:${userZodiac.value}:${userSign.value}`
}

function tryPreloadCache() {
  try {
    const cached = uni.getStorageSync(buildCacheKey())
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
      if (parsed?.daily) {
        dailyData.value = parsed.daily
        reportData.value = parsed
        loading.value = false
        return true
      }
    }
  } catch (_) { /* ignore */ }
  return false
}
const hasPreloadCache = tryPreloadCache()

async function loadData() {
  try {
    let queryError: any = null
    try {
      const result = await queryTaohua(userZodiac.value, userSign.value, selfProfile.value?.gender)
      if (result?.success) {
        dailyData.value = result.data.daily
        practicalData.value = result.data.practical || null
        scoreData.value = result.data.score || null
      } else {
        queryError = result
      }
    } catch (error) {
      queryError = error
    }

    if (!dailyData.value && queryError ) {
      const message = queryError?.message || '命理桃花数据加载失败，请稍后再试。'
      uni.showToast({ title: message, icon: 'none' })
      return
    }

  // 本地计算个人数据
  const dayZhi = dailyData.value.ganzhi.dayZhi
  const yearZhi = dailyData.value.ganzhi.yearPillar?.split(' ')?.[0]?.slice(-1) || '午'
  const monthZhi = dailyData.value.ganzhi.monthPillar?.slice(-1) || '午'

  const localPersonal = hasProfile.value ? {
    benmingTaohua: zodiacToTaohua(userZodiac.value),
    benmingHongluan: hongluanTianxi(userZodiac.value),
    liunianTaohua: xianchiAlgorithm(yearZhi),
    liunianHongluan: hongluanTianxi(yearZhi),
    liuyueTaohua: xianchiAlgorithm(monthZhi),
    liuyueHongluan: hongluanTianxi(monthZhi),
    liuriTaohua: xianchiAlgorithm(dayZhi),
    liuriHongluan: hongluanTianxi(dayZhi),
    cross: zodiacSignMatch(userZodiac.value, userSign.value),
  } : {}

  reportData.value = { daily: dailyData.value, personal: localPersonal }

  // 缓存
  try {
    uni.setStorageSync(buildCacheKey(), JSON.stringify(reportData.value))
    bumpDataVersion()
  } catch (_) { /* ignore */ }

  lastDataVersion.value = Number(uni.getStorageSync('dataVersion') || 0)
  if (!dataReady.value) dataReady.value = true
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const access = await checkFeatureAccess('命理桃花')
    if (!access?.allowed) {
      uni.showModal({
        title: '功能不可用',
        content: access?.reason || '当前月卡不支持命理桃花功能，请购买月卡。',
        confirmText: '返回',
        showCancel: false,
        success: () => uni.navigateBack({ delta: 1 })
      })
      return
    }
  } catch (_) { /* ignore */ }
  await loadData()
  await loadPairMatch()
})

onShow(() => {
  applyThemeChrome()
  fontSizeMode.value = getFontSizeMode()
  pageStyle.value = getThemeStyle()
  refreshProfile()

  const dv = Number(uni.getStorageSync('dataVersion') || 0)
  if (dataReady.value && dv > lastDataVersion.value) {
    loading.value = true
    loadData()
  }
})

// 统一报告：保持与旧 mock 相同结构，优先级：实时 > 空态
const computedReport = computed(() => {
  const d = dailyData.value
  const p = (reportData.value as any)?.personal || {}
  if (!d) return {}

  const mk = {} as any
  const dayZhi = d.ganzhi?.dayZhi || '丑'
  const yearZhi = d.ganzhi?.yearPillar?.split(' ')?.[0]?.slice(-1) || '午'
  const monthZhi = d.ganzhi?.monthPillar?.slice(-1) || '午'

  return {
    元数据: { ...mk.元数据, 生肖: userZodiac.value, 星座: userSign.value },
    节气: { ...mk.节气, ...(d.jieqi || {}), 年柱: d.ganzhi?.yearPillar || mk.节气?.年柱, 月柱: d.ganzhi?.monthPillar || mk.节气?.月柱 },
    今日方位: {
      公历日期: d.solarDate || mk.今日方位?.公历日期,
      农历: d.lunarDate || mk.今日方位?.农历,
      日柱: d.ganzhi?.dayGanZhi || mk.今日方位?.日柱,
      日干: d.ganzhi?.dayGan || mk.今日方位?.日干,
      日支: d.ganzhi?.dayZhi || mk.今日方位?.日支,
      喜神: d.fangwei?.xishen ? { 方位: d.fangwei.xishen.fangwei || d.fangwei.xishen.方位 } : mk.今日方位?.喜神,
      财神: d.fangwei?.caishen ? { 方位: d.fangwei.caishen.fangwei || d.fangwei.caishen.方位 } : mk.今日方位?.财神,
      福神: d.fangwei?.fushen ? { 方位: d.fangwei.fushen.fangwei || d.fangwei.fushen.方位 } : mk.今日方位?.福神,
      阳贵: d.fangwei?.yanggui ? { 方位: d.fangwei.yanggui.fangwei || d.fangwei.yanggui.方位 } : mk.今日方位?.阳贵,
      阴贵: d.fangwei?.yingui ? { 方位: d.fangwei.yingui.fangwei || d.fangwei.yingui.方位 } : mk.今日方位?.阴贵,
      二十八宿: d.ershibaxiu || mk.今日方位?.二十八宿,
      彭祖百忌: d.pengzu || mk.今日方位?.彭祖百忌,
      生肖日冲: d.chongsha || mk.今日方位?.生肖日冲,
      煞方: d.shafang || mk.今日方位?.煞方,
    },
    今日宜忌: { ...mk.今日宜忌, ...(d.yiji || {}), 建除: d.yiji?.jianchu || mk.今日宜忌?.建除, 宜: d.yiji?.yi || mk.今日宜忌?.宜, 忌: d.yiji?.ji || mk.今日宜忌?.忌, 吉神: d.yiji?.jishen || mk.今日宜忌?.吉神, 凶煞: d.yiji?.xiongsha || mk.今日宜忌?.凶煞 },
    本命桃花: (p as any).benmingTaohua || mk.本命桃花,
    本命红鸾天喜: (p as any).benmingHongluan || mk.本命红鸾天喜,
    流年桃花: (p as any).liunianTaohua || mk.流年桃花,
    流月桃花: (p as any).liuyueTaohua || mk.流月桃花,
    流日桃花: (p as any).liuriTaohua || mk.流日桃花,
    流年红鸾天喜: (p as any).liunianHongluan || mk.流年红鸾天喜,
    流月红鸾天喜: (p as any).liuyueHongluan || mk.流月红鸾天喜,
    流日红鸾天喜: (p as any).liuriHongluan || mk.流日红鸾天喜,
    属相星座交叉: (p as any).cross ? {
      生肖: (p as any).cross.zodiac || mk.属相星座交叉?.生肖,
      中国星次: {
        名称: (p as any).cross.chinese?.name || mk.属相星座交叉?.中国星次?.名称,
        地支: (p as any).cross.chinese?.zhi || mk.属相星座交叉?.中国星次?.地支,
        宫位: (p as any).cross.chinese?.gong || mk.属相星座交叉?.中国星次?.宫位,
        五行: (p as any).cross.chinese?.wuxing || mk.属相星座交叉?.中国星次?.五行,
        阴阳: (p as any).cross.chinese?.yinyang || mk.属相星座交叉?.中国星次?.阴阳,
        性格: (p as any).cross.chinese?.character || mk.属相星座交叉?.中国星次?.性格,
        节气范围: (p as any).cross.chinese?.jieqiRange || mk.属相星座交叉?.中国星次?.节气范围,
        近似公历: (p as any).cross.chinese?.dateApprox || mk.属相星座交叉?.中国星次?.近似公历,
      },
      地支关系: (p as any).cross.relation || mk.属相星座交叉?.地支关系,
      关系解读: (p as any).cross.relationDesc || mk.属相星座交叉?.关系解读,
      西方星座: {
        主宰星: (p as any).cross.western?.planet || mk.属相星座交叉?.西方星座?.主宰星,
        元素: (p as any).cross.western?.element || mk.属相星座交叉?.西方星座?.元素,
        形态: (p as any).cross.western?.mode || mk.属相星座交叉?.西方星座?.形态,
        桃花风格: (p as any).cross.western?.personality || mk.属相星座交叉?.西方星座?.桃花风格,
        公历日期: (p as any).cross.western?.dateRange || mk.属相星座交叉?.西方星座?.公历日期,
        古典出处: (p as any).cross.western?.classicalNote || mk.属相星座交叉?.西方星座?.古典出处,
        出处: (p as any).cross.western?.source || mk.属相星座交叉?.西方星座?.出处,
        最佳配对: (p as any).cross.western?.bestMatch || mk.属相星座交叉?.西方星座?.最佳配对,
        配对原理: (p as any).cross.western?.bestMatchReason || mk.属相星座交叉?.西方星座?.配对原理,
      },
    } : mk.属相星座交叉,
    桃花指数: scoreData.value || mk.桃花指数 || null,
    今日行动指南: practicalData.value || mk.今日行动指南 || null,
    综合建议: mk.综合建议,
  }
})

// ============================================================
// 计算属性
// ============================================================

const hasProfile = computed(() => {
  return !!(selfProfile.value?.zodiac && selfProfile.value?.constellation)
})

const dailyTaohuaDir = computed(() => computedReport.value.流日桃花?.direction || '正南')
const dailyTaohuaZhi = computed(() => computedReport.value.流日桃花?.taohua_zhi || '午')
const dailyTaohuaWuxing = computed(() => computedReport.value.流日桃花?.wuxing || '火')
const taohuaScore = computed(() => Number(computedReport.value.桃花指数?.分数 ?? 50))
const isLowTaohuaScore = computed(() => taohuaScore.value < 40)
const showGuideInfo = ref(false)
const guide = computed(() => {
  const ag = computedReport.value.今日行动指南
  if (!ag) return {}
  if (ag.约会指南) return ag.约会指南
  const oldDate = ag.约会方位
  const oldActivity = ag.活动建议
  if (!oldActivity) return {}
  return {
    方位: oldDate?.桃花方位?.方位 || '',
    场所建议: oldDate?.桃花方位?.场所建议 || '',
    今日气场: oldActivity.今日气场 || '',
    解读: oldActivity.解读 || '',
    建议活动: oldActivity.建议活动 || [],
    宜做: oldActivity.宜做 || [],
    避开: oldActivity.避开 || [],
    一句话: oldDate?.一句话 || oldActivity.一句话 || '',
    isLow: (oldDate?.一句话 || '').includes('偏低') || (oldDate?.一句话 || '').includes('不建议'),
  }
})
const guideVibeLabel = computed(() => guide.value.今日气场 || guide.value.解读 || '今日感情运势')
const guideOneliner = computed(() => guide.value.一句话 || '')
// 后端文本可能含 emoji（评级/气场），真机 emoji 渲染不稳，统一走 SVG 混排
const guideMainSegs = computed(() => parseEmojiText(guideOneliner.value || computedReport.value.桃花指数?.一句话 || '今天先用低压力方式靠近。'))
const scoreNoteSegs = computed(() => parseEmojiText(computedReport.value.桃花指数?.一句话 || ''))
const vibeSegs = computed(() => parseEmojiText(guideVibeLabel.value))
const guideActivities = computed(() => guide.value.建议活动 || [])
const guideDos = computed(() => guide.value.宜做 || [])
const guideDonts = computed(() => guide.value.避开 || [])
const guideDirection = computed(() => guide.value.方位 || '--')
const guideLiuheDir = computed(() => guide.value.六合方位 || guide.value.天喜方位 || '')
// 本命红鸾/天喜方位 —— 统一走共享 hongluanTianxi（细粒度 ZHI_TO_DIRECTION），与「今日桃花」teaser、桃花方位全览表保持一致
const natalHongluanDir = computed(() => {
  const z = userZodiac.value
  if (!z) return ''
  try { return hongluanTianxi(z).hongluan.direction || '' } catch { return '' }
})
const natalTianxiDir = computed(() => {
  const z = userZodiac.value
  if (!z) return ''
  try { return hongluanTianxi(z).tianxi.direction || '' } catch { return '' }
})

// getZodiacEmoji migrated to getZodiacSvg from @/utils/zodiac-icons

function getSignEmoji(sign = '') {
  const map: Record<string, string> = {
    '白羊座': '♈', '金牛座': '♉', '双子座': '♊', '巨蟹座': '♋',
    '狮子座': '♌', '处女座': '♍', '天秤座': '♎', '天蝎座': '♏',
    '射手座': '♐', '摩羯座': '♑', '水瓶座': '♒', '双鱼座': '♓',
  }
  return map[sign] || '✦'
}

const zodiacSvg = computed(() => getZodiacSvg(userZodiac.value))
const signEmojiSvg = computed(() => getConstellationSvg(userSign.value))

function relationToneClass(relation = '') {
  if (relation.includes('六合')) return 'great'
  if (relation.includes('三合')) return 'good'
  if (relation.includes('冲')) return 'caution'
  return 'neutral'
}

function signRelationToneClass(relation = '') {
  if (relation.includes('同频') || relation.includes('助燃') || relation.includes('滋养')) return 'good'
  if (relation.includes('差') || relation.includes('磨合') || relation.includes('校准')) return 'caution'
  return 'neutral'
}

// 属相×星座交叉（本地计算）
const crossData = computed<CrossMatchResult>(() => {
  try {
    return zodiacSignMatch(userZodiac.value, userSign.value)
  } catch {
    return null as any
  }
})

const personaParts = computed(() => {
  const personality = String(crossData.value?.western?.personality || '桃花吸引型——越真实越容易被看见')
  const parts = personality.split('——').map(s => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { title: parts[0], desc: parts.slice(1).join('——') }
  }
  return { title: personality || '桃花吸引型', desc: '越真实越容易被看见，适合用自然互动慢慢升温。' }
})
const personaTitle = computed(() => personaParts.value.title)
const personaDesc = computed(() => personaParts.value.desc)
const chinesePersonaLine = computed(() => {
  const c = crossData.value?.chinese
  if (!c) return ''
  return `${c.name || ''} · ${c.zhi || ''} · ${c.wuxing || ''} · ${c.yinyang || ''}`.replace(/\s*·\s*$/g, '')
})

// 匹配徽章样式
const matchBadgeClass = computed(() => {
  const r = crossData.value?.relation || ''
  if (r.includes('六合')) return 'great'
  if (r.includes('三合')) return 'good'
  if (r.includes('冲')) return 'caution'
  return 'neutral'
})

// ============================================================
// 配对检查
// ============================================================
const showMatchSheet = ref(false)
const zodiacNames = ref(ZODIAC_NAMES)
const signNames = ref(SIGN_NAMES)
const matchZodiacIdx = ref(0)
const matchSignIdx = ref(0)

function onMatchZodiacChange(e: any) { matchZodiacIdx.value = e.detail.value }
function onMatchSignChange(e: any) { matchSignIdx.value = e.detail.value }

function openMatchSheet() {
  const partnerZodiac = pairParticipants.value?.partnerZodiac || defaultPairState.value?.participants.partnerZodiac || ''
  const partnerSign = pairParticipants.value?.partnerSign || defaultPairState.value?.participants.partnerSign || ''
  matchZodiacIdx.value = Math.max(0, zodiacNames.value.indexOf(partnerZodiac))
  matchSignIdx.value = Math.max(0, signNames.value.indexOf(partnerSign))
  showMatchSheet.value = true
}

function handlePairGuideClick() {
  if (hasProfile.value) {
    openMatchSheet()
    return
  }
  goSelfProfile()
}

function buildPairState(partnerZodiac: string, partnerSign: string, partnerLabel = '预览 TA') {
  const pairPayload = buildPairMatchPayload(userZodiac.value, userSign.value, partnerZodiac, partnerSign)
  const pair = pairPayload.match
  return {
    match: {
      relation: pair.relation,
      relationDesc: pair.relationDesc,
      signRelation: pair.signRelation,
      signRelationDesc: pair.signRelationDesc,
      combinedRelation: pair.combinedRelation,
      combinedRelationDesc: pair.combinedRelationDesc,
    },
    participants: {
      selfLabel: '我',
      selfZodiac: userZodiac.value,
      selfSign: userSign.value,
      partnerLabel,
      partnerZodiac,
      partnerSign
    },
    insight: pairPayload.insight,
    partnerStyle: pairPayload.partnerStyle
  }
}

function doMatchCheck() {
  const z = zodiacNames.value[matchZodiacIdx.value]
  const s = signNames.value[matchSignIdx.value]
  try {
    const label = defaultPairState.value?.participants.partnerLabel ? `${defaultPairState.value.participants.partnerLabel}（预览）` : '预览 TA'
    previewPairState.value = buildPairState(z, s, label)
    pairMatch.value = previewPairState.value.match
    pairParticipants.value = previewPairState.value.participants
    pairInsight.value = previewPairState.value.insight
    pairPartnerStyle.value = previewPairState.value.partnerStyle || ''
    pairAIResult.value = null
    isPairPreviewing.value = true
    showMatchSheet.value = false
  } catch (e: any) {
    uni.showToast({ title: e.message || '配对失败', icon: 'none' })
  }
}

// ============================================================
// 桃花匹配度（绑定 Crush：从"我们"页带 caseId 进入，含 AI 深度解读）
// ============================================================
const boundCaseId = ref('')
const defaultPairState = ref<{
  match: PairMatchView
  participants: {
    selfLabel: string
    selfZodiac: string
    selfSign: string
    partnerLabel: string
    partnerZodiac: string
    partnerSign: string
  }
  insight: PairInsight
  partnerStyle?: string
} | null>(null)
const previewPairState = ref<{
  match: PairMatchView
  participants: {
    selfLabel: string
    selfZodiac: string
    selfSign: string
    partnerLabel: string
    partnerZodiac: string
    partnerSign: string
  }
  insight: PairInsight
  partnerStyle?: string
} | null>(null)
type PairMatchView = {
  relation: string
  relationDesc: string
  signRelation?: string
  signRelationDesc?: string
  combinedRelation?: string
  combinedRelationDesc?: string
}
const pairMatch = ref<PairMatchView | null>(null)
const pairInsight = ref<PairInsight | null>(null)
const pairParticipants = ref<{
  selfLabel: string
  selfZodiac: string
  selfSign: string
  partnerLabel: string
  partnerZodiac: string
  partnerSign: string
} | null>(null)
const pairReadLoading = ref(false)
const pairAIResult = ref<any>(null)
const pairPartnerStyle = ref('')
const crushProfile = ref<any>(null)
const crushMbtiDisplay = computed(() => crushProfile.value?.mbtiCode || '')
const crushIdentityDisplay = computed(() => resolveIdentityLabel(crushProfile.value || null))
const showPairReadGuide = ref(false)
const isPairPreviewing = ref(false)
const canRestoreCurrentPair = computed(() => !!defaultPairState.value)
const currentPairPartnerZodiacIdx = computed(() => {
  const zodiac = pairParticipants.value?.partnerZodiac || defaultPairState.value?.participants.partnerZodiac || ''
  const idx = zodiacNames.value.indexOf(zodiac)
  return idx >= 0 ? idx : 0
})
const currentPairPartnerSignIdx = computed(() => {
  const sign = pairParticipants.value?.partnerSign || defaultPairState.value?.participants.partnerSign || ''
  const idx = signNames.value.indexOf(sign)
  return idx >= 0 ? idx : 0
})

async function loadPairMatch() {
  if (!boundCaseId.value) return
  try {
    const uid = getCurrentUserId()
    if (!uid) return
    const detail = await getCaseDetail(uid, boundCaseId.value)
    const crush = detail?.profile
    crushProfile.value = crush || null
    let self = getCachedSelfProfile()
    if (!self?.zodiac || !self?.constellation) {
      const profileRes = await getSelfProfile().catch(() => null)
      self = profileRes?.selfProfile || getCachedSelfProfile()
    }
    if (!self?.zodiac || !self?.constellation || !crush?.zodiac || !crush?.constellation) {
      showPairReadGuide.value = !!(self?.zodiac || crush?.zodiac)
      defaultPairState.value = null
      previewPairState.value = null
      pairMatch.value = null
      pairInsight.value = null
      pairParticipants.value = null
      pairPartnerStyle.value = ''
      isPairPreviewing.value = false
      return
    }
    defaultPairState.value = buildPairState(
      crush.zodiac,
      crush.constellation,
      String(detail?.name || 'TA').trim() || 'TA'
    )
    previewPairState.value = null
    pairMatch.value = defaultPairState.value.match
    pairParticipants.value = defaultPairState.value.participants
    pairInsight.value = defaultPairState.value.insight
    pairPartnerStyle.value = defaultPairState.value.partnerStyle || ''
    showPairReadGuide.value = false
    isPairPreviewing.value = false
  } catch {
    defaultPairState.value = null
    previewPairState.value = null
    pairMatch.value = null
    pairInsight.value = null
    pairParticipants.value = null
    pairPartnerStyle.value = ''
    isPairPreviewing.value = false
    showPairReadGuide.value = false
  }
}

function restoreCurrentPair() {
  if (!defaultPairState.value) return
  previewPairState.value = null
  pairMatch.value = defaultPairState.value.match
  pairParticipants.value = defaultPairState.value.participants
  pairInsight.value = defaultPairState.value.insight
  pairPartnerStyle.value = defaultPairState.value.partnerStyle || ''
  pairAIResult.value = null
  isPairPreviewing.value = false
}

function restoreCurrentPairFromSheet() {
  restoreCurrentPair()
  showMatchSheet.value = false
}

function applyInlinePairPreview(partnerZodiac: string, partnerSign: string) {
  if (!defaultPairState.value) return
  const defaultZodiac = defaultPairState.value.participants.partnerZodiac
  const defaultSign = defaultPairState.value.participants.partnerSign
  if (partnerZodiac === defaultZodiac && partnerSign === defaultSign) {
    restoreCurrentPair()
    return
  }
  const label = `${defaultPairState.value.participants.partnerLabel}（预览）`
  previewPairState.value = buildPairState(partnerZodiac, partnerSign, label)
  pairMatch.value = previewPairState.value.match
  pairParticipants.value = previewPairState.value.participants
  pairInsight.value = previewPairState.value.insight
  pairPartnerStyle.value = previewPairState.value.partnerStyle || ''
  pairAIResult.value = null
  isPairPreviewing.value = true
}

function onPreviewPairZodiacChange(e: any) {
  const zodiac = zodiacNames.value[e?.detail?.value ?? 0]
  const sign = pairParticipants.value?.partnerSign || defaultPairState.value?.participants.partnerSign || ''
  if (!zodiac || !sign) return
  applyInlinePairPreview(zodiac, sign)
}

function onPreviewPairSignChange(e: any) {
  const sign = signNames.value[e?.detail?.value ?? 0]
  const zodiac = pairParticipants.value?.partnerZodiac || defaultPairState.value?.participants.partnerZodiac || ''
  if (!zodiac || !sign) return
  applyInlinePairPreview(zodiac, sign)
}

async function doPairAIDeepRead() {
  if (pairReadLoading.value || !boundCaseId.value) return
  pairReadLoading.value = true
  try {
    const res = await generatePairRead(boundCaseId.value)
    if (res?.success) {
      pairAIResult.value = res.aiEnhanced || { message: '暂无深度解读内容' }
    } else {
      pairAIResult.value = { fallback: true, message: res?.message || '解读暂不可用' }
    }
  } catch (error: any) {
    pairAIResult.value = { fallback: true, message: error?.message || '解读请求失败，请稍后再试' }
  } finally {
    pairReadLoading.value = false
  }
}

onLoad((options: any) => {
  boundCaseId.value = options?.caseId || getActiveCaseId() || ''
})

// ============================================================
// 导航
// ============================================================
function goSelfProfile() {
  uni.navigateTo({ url: '/pages/self-profile/self-profile' })
}

// ============================================================
// Canvas 分享卡
// ============================================================
const showSharePreview = ref(false)
const shareImagePath = ref('')
const shareMode = ref<'persona' | 'pair'>('persona')
let shareCanvasNode: any = null
const SHARE_CARD_W = 640
const SHARE_CARD_H = 512

const sharePreviewTitle = computed(() => shareMode.value === 'pair' ? '我和 TA 的桃花匹配' : '我的桃花人格卡')
const canSaveShareImage = computed(() => !!shareImagePath.value && !String(shareImagePath.value).startsWith('cloud://'))

onShareAppMessage(() => {
  if (shareMode.value === 'pair' && pairParticipants.value && pairMatch.value) {
    return {
      title: `${pairParticipants.value.selfZodiac || '我'} × ${pairParticipants.value.partnerZodiac || 'TA'} 的桃花匹配度`,
      path: appendReferralParams(buildPairSharePath(), 'taohua_pair'),
      imageUrl: shareImagePath.value || TAOHUA_SHARE_IMAGE,
    }
  }
  return {
    title: `${userZodiac.value || '我'} · ${userSign.value || '星座'} 的桃花人格卡`,
    path: appendReferralParams(buildTaohuaSharePath(), 'taohua_card'),
    imageUrl: TAOHUA_SHARE_IMAGE,
  }
})

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

function sharePersona() {
  shareMode.value = 'persona'
  shareImagePath.value = TAOHUA_SHARE_IMAGE
  showSharePreview.value = true
}

function sharePairMatch() {
  if (!pairParticipants.value || !pairMatch.value) {
    uni.showToast({ title: '先生成配对结果', icon: 'none' })
    return
  }
  shareMode.value = 'pair'
  shareImagePath.value = ''
  generatePairShareCard()
}

function buildTaohuaSharePath() {
  const params = [
    `zodiac=${encodeURIComponent(userZodiac.value || '')}`,
    `sign=${encodeURIComponent(userSign.value || '')}`,
    `from=persona`
  ]
  return `/pages/taohua-share/taohua-share?${params.join('&')}`
}

function buildPairSharePath() {
  const p = pairParticipants.value
  const params = [
    `selfZodiac=${encodeURIComponent(p?.selfZodiac || userZodiac.value || '')}`,
    `selfSign=${encodeURIComponent(p?.selfSign || userSign.value || '')}`,
    `taZodiac=${encodeURIComponent(p?.partnerZodiac || '')}`,
    `taSign=${encodeURIComponent(p?.partnerSign || '')}`,
    `from=pair`
  ]
  return `/pages/taohua-pair-share/taohua-pair-share?${params.join('&')}`
}

function generateShareCard() {
  const query = uni.createSelectorQuery()
  query.select('#taohuaShareCanvas')
    .fields({ node: true, size: true })
    .exec((res: any) => {
      if (!res[0] || !res[0].node) {
        uni.showToast({ title: '分享卡生成失败', icon: 'none' })
        return
      }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = uni.getSystemInfoSync().pixelRatio
      canvas.width = SHARE_CARD_W * dpr
      canvas.height = SHARE_CARD_H * dpr
      ctx.scale(dpr, dpr)

      drawShareCard(ctx)
      shareCanvasNode = canvas
    })
}

function generatePairShareCard() {
  const query = uni.createSelectorQuery()
  query.select('#taohuaShareCanvas')
    .fields({ node: true, size: true })
    .exec((res: any) => {
      if (!res[0] || !res[0].node) {
        uni.showToast({ title: '分享卡生成失败', icon: 'none' })
        return
      }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = uni.getSystemInfoSync().pixelRatio
      canvas.width = SHARE_CARD_W * dpr
      canvas.height = SHARE_CARD_H * dpr
      ctx.scale(dpr, dpr)

      drawPairShareCard(ctx)
      shareCanvasNode = canvas
    })
}

function drawPairShareCard(ctx: any) {
  const W = SHARE_CARD_W, H = SHARE_CARD_H
  const p = pairParticipants.value
  const match = pairMatch.value
  const insight = pairInsight.value
  if (!p || !match) return

  ctx.clearRect(0, 0, W, H)

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#FFF6E4')
  bg.addColorStop(0.5, '#EAF7FF')
  bg.addColorStop(1, '#FFFDF5')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  drawCompassMark(ctx, 534, 88, 74)
  drawHardPanel(ctx, 26, 24, 588, 448, '#FFFDF5', 8, 3)

  drawHardPanel(ctx, 48, 46, 544, 104, '#4ECDC4', 7, 3)
  ctx.fillStyle = '#111'
  ctx.fillRect(72, 64, 92, 25)
  ctx.font = 'bold 15px sans-serif'
  ctx.fillStyle = '#FFD93D'
  ctx.fillText('PAIR MATCH', 78, 83)
  ctx.font = 'bold 34px sans-serif'
  ctx.fillStyle = '#111'
  ctx.fillText('桃花匹配度', 72, 122)
  ctx.font = 'bold 17px sans-serif'
  ctx.fillStyle = 'rgba(0,0,0,0.68)'
  ctx.fillText('测测你和 TA 的桃花节奏', 350, 122)

  drawPairPersonBlock(ctx, 54, 184, 168, 160, '我', p.selfZodiac, p.selfSign, '#FFD93D')
  drawPairPersonBlock(ctx, 418, 184, 168, 160, p.partnerLabel || 'TA', p.partnerZodiac, p.partnerSign, '#FFE7E1')

  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = '#666'
  ctx.textAlign = 'center'
  ctx.fillText('匹配', 320, 198)
  ctx.textAlign = 'left'
  drawPairRelationText(ctx, 248, 224, 144, '生肖', match.relation, relationCanvasColor(match.relation))
  drawPairRelationText(ctx, 248, 286, 144, '星座', match.signRelation || '星座节奏平衡', relationCanvasColor(match.signRelation || ''))

  drawHardPanel(ctx, 54, 366, 532, 58, '#FFF4C7', 5, 3)
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = '#8A3A28'
  ctx.fillText('一句话', 78, 390)
  ctx.font = 'bold 18px sans-serif'
  ctx.fillStyle = '#111'
  wrapTextLimited(ctx, match.combinedRelationDesc || insight?.styleClash || '你们是顺势靠近，还是需要磨合节奏？', 144, 391, 410, 24, 1)

  drawHardPanel(ctx, 48, 432, 544, 34, '#111111', 4, 3)
  ctx.font = 'bold 17px sans-serif'
  ctx.fillStyle = '#FFD93D'
  ctx.fillText('Crush Master · 双人桃花匹配', 70, 454)
  ctx.font = 'bold 15px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillText('打开小程序，测测你和 TA 的配对', 360, 454)

  setTimeout(() => {
    uni.canvasToTempFilePath({
      canvas: shareCanvasNode,
      success: (res: any) => {
        shareImagePath.value = res.tempFilePath
        showSharePreview.value = true
      },
      fail: () => {
        uni.showToast({ title: '图片生成失败', icon: 'none' })
      },
    })
  }, 300)
}

function drawPairPersonBlock(ctx: any, x: number, y: number, w: number, h: number, label: string, zodiac: string, sign: string, bg: string) {
  drawHardPanel(ctx, x, y, w, h, '#FFFFFF', 5, 3)
  ctx.setLineDash([8, 6])
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 12, y + 12, w - 24, h - 24)
  ctx.setLineDash([])

  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = '#666'
  ctx.textAlign = 'center'
  ctx.fillText(label, x + w / 2, y + 38)

  ctx.fillStyle = bg
  ctx.fillRect(x + 32, y + 58, w - 64, 34)
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 32, y + 58, w - 64, 34)
  ctx.font = 'bold 18px sans-serif'
  ctx.fillStyle = '#111'
  ctx.fillText(zodiac || '生肖', x + w / 2, y + 82)

  ctx.fillStyle = '#EAF7FF'
  ctx.fillRect(x + 32, y + 104, w - 64, 34)
  ctx.strokeRect(x + 32, y + 104, w - 64, 34)
  ctx.font = 'bold 17px sans-serif'
  ctx.fillStyle = '#111'
  ctx.fillText(sign || '星座', x + w / 2, y + 128)
  ctx.textAlign = 'left'
}

function drawPairRelationText(ctx: any, x: number, y: number, w: number, label: string, value: string, color: string) {
  ctx.font = 'bold 14px sans-serif'
  ctx.fillStyle = '#777'
  ctx.textAlign = 'center'
  ctx.fillText(label, x + w / 2, y)
  ctx.font = 'bold 20px sans-serif'
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  wrapTextLimited(ctx, value || '--', x + 8, y + 30, w - 16, 24, 1)
}

function relationCanvasColor(relation = '') {
  if (relation.includes('六合') || relation.includes('同频') || relation.includes('助燃') || relation.includes('滋养')) return '#0A8F86'
  if (relation.includes('三合') || relation.includes('同宫') || relation.includes('平衡')) return '#A87600'
  if (relation.includes('冲') || relation.includes('差') || relation.includes('磨合') || relation.includes('校准')) return '#D33F49'
  return '#111'
}

function drawShareCard(ctx: any) {
  const W = SHARE_CARD_W, H = SHARE_CARD_H
  const signData = crossData.value
  const western = signData?.western || {}
  const chinese = signData?.chinese || {}
  const personality = western.personality || '自带吸引力，越真实越容易被看见'
  const personaTitle = String(personality).split('——')[0] || '桃花吸引型'
  const personaDesc = String(personality).split('——')[1] || personality
  const zodiac = userZodiac.value || '生肖'
  const sign = userSign.value || '星座'
  const starName = chinese.name || '--'
  const starMeta = chinese.zhi ? `${chinese.zhi} · ${chinese.wuxing || ''}${chinese.yinyang || ''}` : '中国星次'
  const planetLine = western.planet
    ? `${western.planet}守护 · ${western.element || ''}象${String(western.mode || '').split('（')[0]}`
    : '星座能量待解锁'
  const bestMatch = Array.isArray(western.bestMatch) ? western.bestMatch.slice(0, 3) : []

  ctx.clearRect(0, 0, W, H)

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#FFF6E4')
  bg.addColorStop(0.45, '#FFE1D8')
  bg.addColorStop(1, '#FFFDF5')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  drawCompassMark(ctx, 532, 90, 74)

  // Page screenshot frame for the WeChat 5:4 share thumbnail.
  drawHardPanel(ctx, 26, 24, 588, 448, '#FFFDF5', 8, 3)

  drawHardPanel(ctx, 48, 46, 544, 112, '#FF6B6B', 7, 3)
  ctx.fillStyle = '#111'
  ctx.fillRect(72, 66, 88, 25)
  ctx.font = 'bold 15px sans-serif'
  ctx.fillStyle = '#FFD93D'
  ctx.fillText('TAOHUA', 82, 85)
  ctx.font = 'bold 32px sans-serif'
  ctx.fillStyle = '#111'
  ctx.fillText('TA 的桃花人格卡', 72, 126)
  ctx.font = 'bold 18px sans-serif'
  ctx.fillStyle = 'rgba(0,0,0,0.68)'
  ctx.fillText(`${zodiac} · ${sign} · ${starName}`, 350, 126)

  drawHardPanel(ctx, 48, 184, 350, 210, '#FFFFFF', 7, 3)
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.strokeStyle = '#7F2B1D'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(336, 236, 52, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(102, 248, 43, 0, Math.PI * 2)
  ctx.fill()
  const seal = ctx.createLinearGradient(62, 206, 136, 286)
  seal.addColorStop(0, '#FFD93D')
  seal.addColorStop(1, '#FF8E7D')
  ctx.fillStyle = seal
  ctx.beginPath()
  ctx.arc(96, 242, 43, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(96, 242, 33, 0, Math.PI * 2)
  ctx.stroke()
  ctx.font = 'bold 34px sans-serif'
  ctx.fillStyle = '#111'
  ctx.textAlign = 'center'
  ctx.fillText(zodiac.slice(0, 1), 96, 254)
  ctx.textAlign = 'left'

  ctx.font = 'bold 17px sans-serif'
  ctx.fillStyle = '#8A3A28'
  ctx.fillText('吸引力关键词', 162, 228)
  ctx.font = 'bold 30px sans-serif'
  ctx.fillStyle = '#111'
  wrapTextLimited(ctx, personaTitle, 162, 266, 204, 34, 2)

  drawPill(ctx, 72, 306, 84, 32, zodiac, '#111', '#FFD93D', 16)
  drawPill(ctx, 168, 306, 94, 32, sign, '#FFF0E5', '#8A3A28', 16)
  drawPill(ctx, 274, 306, 86, 32, starMeta, '#F5F0E8', '#111', 14)

  ctx.fillStyle = '#FFE7E1'
  ctx.fillRect(72, 352, 296, 28)
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 2
  ctx.strokeRect(72, 352, 296, 28)
  ctx.font = 'bold 15px sans-serif'
  ctx.fillStyle = '#111'
  wrapTextLimited(ctx, personaDesc, 84, 372, 272, 20, 1)

  drawHardPanel(ctx, 424, 184, 142, 74, '#FFF4C7', 5, 3)
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = '#8A3A28'
  ctx.fillText('西方星座', 442, 214)
  ctx.font = 'bold 15px sans-serif'
  ctx.fillStyle = '#111'
  wrapTextLimited(ctx, planetLine, 442, 242, 104, 20, 1)

  drawHardPanel(ctx, 424, 276, 142, 74, '#F2F0EA', 5, 3)
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = '#8A3A28'
  ctx.fillText('中国星次', 442, 306)
  ctx.font = 'bold 15px sans-serif'
  ctx.fillStyle = '#111'
  wrapTextLimited(ctx, starName, 442, 334, 104, 20, 1)

  if (bestMatch.length > 0) {
    ctx.font = 'bold 15px sans-serif'
    ctx.fillStyle = '#8A3A28'
    ctx.fillText('高频适配', 424, 382)
    bestMatch.slice(0, 2).forEach((m: string, i: number) => {
      drawPill(ctx, 494 + i * 58, 361, 52, 28, m, '#FFF0E5', '#8A3A28', 13)
    })
  }

  drawHardPanel(ctx, 48, 412, 544, 38, '#111111', 5, 3)
  ctx.font = 'bold 18px sans-serif'
  ctx.fillStyle = '#FFD93D'
  ctx.fillText('Crush Master · 命理桃花', 70, 437)
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillText('打开小程序，生成你的专属人格卡', 322, 437)

  // 导出
  setTimeout(() => {
    uni.canvasToTempFilePath({
      canvas: shareCanvasNode,
      success: (res: any) => {
        shareImagePath.value = res.tempFilePath
        showSharePreview.value = true
      },
      fail: () => {
        uni.showToast({ title: '图片生成失败', icon: 'none' })
      },
    })
  }, 300)
}

function drawHardPanel(ctx: any, x: number, y: number, w: number, h: number, bg: string, shadow = 6, border = 3) {
  ctx.fillStyle = '#111'
  ctx.fillRect(x + shadow, y + shadow, w, h)
  ctx.fillStyle = bg
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#111'
  ctx.lineWidth = border
  ctx.strokeRect(x, y, w, h)
}

function drawRoundRect(ctx: any, x: number, y: number, w: number, h: number, r: number, fill?: string) {
  if (fill) ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

function drawPill(ctx: any, x: number, y: number, w: number, h: number, text: string, bg: string, fg: string, size: number) {
  drawRoundRect(ctx, x, y, w, h, h / 2, bg)
  ctx.font = `bold ${size}px sans-serif`
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2 + 1)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawSection(ctx: any, x: number, y: number, w: number, h: number, title: string, bg: string) {
  drawHardPanel(ctx, x, y, w, h, bg, 5, 3)
  ctx.font = 'bold 20px sans-serif'
  ctx.fillStyle = '#8A3A28'
  ctx.fillText(title, x + 28, y + 42)
  ctx.strokeStyle = 'rgba(17,17,17,0.22)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + 28, y + 58)
  ctx.lineTo(x + w - 28, y + 58)
  ctx.stroke()
}

function drawCompassMark(ctx: any, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.globalAlpha = 0.32
  ctx.strokeStyle = '#7F2B1D'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.64, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r * 0.36, cy + Math.sin(a) * r * 0.36)
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    ctx.stroke()
  }
  ctx.restore()
}

function wrapTextLimited(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const chars = text.split('')
  let line = ''
  let cy = y
  let lines = 0
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines += 1
      if (lines >= maxLines) {
        ctx.fillText(`${line.slice(0, Math.max(0, line.length - 1))}…`, x, cy)
        return
      }
      ctx.fillText(line, x, cy)
      line = ch
      cy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, cy)
}

function wrapText(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  wrapTextLimited(ctx, text, x, y, maxWidth, lineHeight, 20)
}

async function saveShareImage() {
  if (!shareImagePath.value) return
  // 先确保隐私协议已同意（微信 2023.09 起要求）
  try {
    const wxApi = (globalThis as any)?.wx
    if (wxApi?.requirePrivacyAuthorize) {
      await new Promise<void>((resolve, reject) => {
        wxApi.requirePrivacyAuthorize({ success: () => resolve(), fail: reject })
      })
    }
  } catch {
    uni.showToast({ title: '请先同意隐私政策', icon: 'none' })
    return
  }

  uni.saveImageToPhotosAlbum({
    filePath: shareImagePath.value,
    success: () => {
      uni.showToast({ title: '已保存到相册', icon: 'success' })
      showSharePreview.value = false
    },
    fail: () => {
      uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    },
  })
}

</script>

<style scoped lang="scss">
@import "@/styles/campus-pop.scss";
/* ============================================================
   页面级 v2 样式（复用全站 Campus Pop 设计系统）
   ============================================================ */

/* Loading */
.v2-mode .loading { text-align: center; padding: 120rpx 0; font-size: $fs-kpi; font-weight: var(--font-weight-heading, $fw-heading); color: var(--text-main, #111); letter-spacing: 4rpx; }

/* Hero */
.hero-block-v2 { @include hero-block-v2; margin: 0 20rpx 24rpx; }
.hero-tag-v2 { display: inline-block; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); font-size: $fs-caption; font-weight: var(--font-weight-hero, $fw-hero); padding: 4rpx 14rpx; letter-spacing: 2rpx; margin-bottom: 10rpx; }
.hero-title-v2 { font-size: $fs-hero-title; font-weight: var(--font-weight-hero, $fw-hero); color: var(--hero-text-color, #111); line-height: 1.1; letter-spacing: -2rpx; }
.hl-v2 { background: var(--accent, #FFD93D); padding: 0 6rpx; }
.hero-copy-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, rgba(0,0,0,0.7)); margin-top: 8rpx; line-height: 1.4; }
.taohua-score-avatar { flex-direction: column; gap: 2rpx; background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); }
.taohua-score-main { display: block; font-size: 34rpx; line-height: 1; font-weight: var(--font-weight-hero, $fw-hero); color: inherit; }
.taohua-score-unit { display: block; font-size: 18rpx; line-height: 1; font-weight: $fw-label; color: inherit; }

/* Card */
.card-v2 { @include card-v2; margin: 0 20rpx 24rpx; }
.section-title-v2 { @include section-title-v2; text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 12rpx; }
.section-title-v2.no-margin { margin-bottom: 0; }
.card-text-v2 { display: block; font-size: $fs-body-lg; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.5; margin-bottom: 4rpx; }
.card-text-v2.muted { color: var(--text-soft, #999); font-size: $fs-caption; }
.card-text-v2.strong { color: var(--text-main, #111); font-size: $fs-body; font-weight: $fw-label; }
.card-text-v2.no-margin { margin-bottom: 0; }
.inline-title-v2,
.section-title-row-v2,
.sheet-title-row-v2,
.pair-label-row-v2,
.button-label-v2,
.match-badge-line-v2,
.pair-classical-row-v2 {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.section-title-row-v2 { margin-bottom: 12rpx; }
.section-title-row-v2.center { justify-content: center; }
.button-label-v2 { justify-content: center; }
.tag-with-icon-v2,
.label-with-icon-v2 {
  display: inline-flex !important;
  align-items: center;
  gap: 6rpx;
}
.guide-line-v2 {
  display: flex;
  align-items: flex-start;
  gap: 6rpx;
  margin-top: 4rpx;
}
.guide-line-v2.good,
.guide-text-v2.good,
.pair-text-v2.good { color: var(--relation-good, #4ECDC4); }
.pair-classical-row-v2 {
  align-items: flex-start;
  margin-top: 8rpx;
  padding-top: 8rpx;
  border-top: 1rpx dashed var(--divider, #ddd);
}
.taohua-icon-img {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}
.taohua-icon-emoji {
  display: inline-block;
  flex-shrink: 0;
  line-height: 1;
}

/* 方位条 */
.dir-strip-v2 { display: flex; gap: 8rpx; margin-top: 16rpx; }
.dir-cell-v2 { flex: 1; text-align: center; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface-dim, #f9f9f9); padding: 10rpx 4rpx; }
.dir-lbl-v2 { font-size: $fs-caption; font-weight: 700; color: var(--text-muted, #666); display: block; }
.dir-val-v2 { font-size: 36rpx; font-weight: 900; color: var(--text-main, #111); display: block; margin-top: 2rpx; }

/* info popup */
.info-dot-v2 { display: inline-flex; align-items: center; justify-content: center; width: 36rpx; height: 36rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); font-size: $fs-caption; font-weight: 900; color: var(--text-main, #111); margin-left: auto; cursor: pointer; }
.info-overlay { position: fixed; inset: 0; z-index: 1100; background: var(--overlay, rgba(0,0,0,0.5)); display: flex; align-items: flex-end; justify-content: center; padding-bottom: env(safe-area-inset-bottom); }
.info-sheet { width: 100%; max-width: 500px; max-height: 70vh; background: var(--app-bg, #FFFDF5); border: var(--border-width-strong, 3px) solid var(--border, #111); border-radius: var(--shape-radius-card, 0) var(--shape-radius-card, 0) 0 0; box-shadow: var(--shadow-hero, 8rpx 8rpx 0 #111); display: flex; flex-direction: column; overflow: hidden; }
.info-sheet-head { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 28rpx; border-bottom: var(--border-width, 2rpx) solid var(--divider-strong, #111); flex-shrink: 0; }
.info-sheet-title { font-size: 36rpx; font-weight: 900; color: var(--text-main, #111); }
.info-sheet-close { font-size: $fs-heading; font-weight: 900; color: var(--text-main, #111); padding: 0 8rpx; line-height: 1; }
.info-sheet-body { padding: 24rpx 28rpx; overflow-y: auto; flex: 1; }
.info-tree-item { padding: 14rpx 0; border-bottom: 1rpx dashed var(--divider, #ccc); }
.info-tree-item:last-child { border-bottom: none; }
.info-tree-q { display: block; font-size: $fs-body; font-weight: $fw-label; color: var(--text-main, #111); margin-bottom: 4rpx; }
.info-tree-a { display: block; font-size: $fs-caption; font-weight: 600; color: var(--text-muted, #666); }
.info-tree-divider { height: 12rpx; }
.info-tree-note { display: block; font-size: $fs-caption; color: var(--text-soft, #999); line-height: 1.5; padding-top: 8rpx; }

/* direction highlights */
.guide-dir-hl { display: inline-block; background: var(--accent, #FFD93D); border-radius: var(--shape-radius-control, 0); padding: 2rpx 10rpx; font-weight: 900; }
.guide-dir-hl.hongluan { background: var(--taohua-hongluan, #FF6B6B); color: var(--surface, #fff); }
.guide-dir-hl.tianxi { background: var(--taohua-tianxi, #4ECDC4); color: var(--surface, #fff); }

/* yi-ji inline flow */
.split-item-flow-v2 { font-size: $fs-caption; font-weight: 700; color: var(--text-main, #111); line-height: 1.8; }


/* 标签 */
.tag-row-v2 { display: flex; flex-wrap: wrap; gap: 6rpx; }
.tag-v2 { @include tag-v2; }
.tag-v2.black { background: var(--hero-tag-bg, #111); color: var(--hero-tag-color, #FFD93D); }
.tag-v2.green { background: var(--relation-good, #4ECDC4); color: var(--text-main, #111); }
.tag-v2.red { background: var(--risk, #FF5252); color: var(--surface, #fff); }

/* 人格卡 */
.persona-title-row-v2 { justify-content: space-between; }
.persona-share-action-v2 { width: 56rpx; height: 56rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--brand-warm, #FFFBEA); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.mini-action-v2 { min-width: 104rpx; height: 48rpx; padding: 0 16rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--surface, #fff); color: var(--text-main, #111); display: flex; align-items: center; justify-content: center; font-size: $fs-caption; font-weight: 900; box-sizing: border-box; }
.pair-title-actions-v2 { display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; flex-shrink: 0; }
.pair-share-action-v2 { width: 52rpx; height: 52rpx; border-width: 2rpx; }
.persona-card-v2 { padding: 24rpx; background: var(--surface, #fff); margin-top: 12rpx; }
.persona-hero-v2 { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18rpx; align-items: center; padding-bottom: 18rpx; border-bottom: var(--border-width, 2rpx) dashed var(--divider-strong, #111); }
.persona-hero-copy-v2 { min-width: 0; }
.persona-type-badge-v2 { display: inline-flex; align-items: center; max-width: 100%; min-height: 42rpx; padding: 0 14rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--accent, #FFD93D); font-size: $fs-caption; font-weight: var(--font-weight-hero, $fw-hero); color: var(--text-main, #111); line-height: 1; box-sizing: border-box; }
.persona-main-v2 { display: block; margin-top: 10rpx; font-size: $fs-body; font-weight: var(--font-weight-heading, $fw-heading); color: var(--text-main, #111); line-height: $lh-label; }
.persona-sub-v2 { display: block; margin-top: 6rpx; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); line-height: $lh-label; }
.persona-avatar-stack-v2 { display: flex; align-items: center; justify-content: flex-end; min-width: 118rpx; }
.persona-avatar-icon-v2 { width: 48rpx; height: 48rpx; } .persona-identity-symbol-icon-v2 { width: 32rpx; height: 32rpx; } .pair-token-symbol-icon-v2 { width: 36rpx; height: 36rpx; } .persona-avatar-v2 { width: 72rpx; height: 72rpx; border-radius: 50%; border: var(--border-width-strong, 3rpx) solid var(--border, #111); background: var(--accent, #FFD93D); display: flex; align-items: center; justify-content: center; font-size: $fs-heading; font-weight: var(--font-weight-hero, $fw-hero); color: var(--text-main, #111); line-height: 1; flex-shrink: 0; box-sizing: border-box; }
.persona-avatar-v2.sign { margin-left: -12rpx; background: var(--brand-cool, #EAF7FF); }
.persona-identity-strip-v2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10rpx; margin-top: 16rpx; }
.persona-identity-item-v2 { min-width: 0; min-height: 76rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--brand-warm, #FFFBEA); display: flex; align-items: center; gap: 10rpx; padding: 10rpx; box-sizing: border-box; }
.persona-identity-item-v2.alt { background: var(--brand-cool, #EAF7FF); }
.persona-identity-symbol-v2 { width: 42rpx; height: 42rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: 50%; background: var(--surface, #fff); display: flex; align-items: center; justify-content: center; font-size: $fs-caption; font-weight: var(--font-weight-hero, $fw-hero); color: var(--text-main, #111); line-height: 1; flex-shrink: 0; box-sizing: border-box; }
.persona-identity-copy-v2 { min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.persona-identity-label-v2 { font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); line-height: 1; }
.persona-identity-value-v2 { max-width: 100%; font-size: $fs-body-lg; font-weight: var(--font-weight-heading, $fw-heading); color: var(--text-main, #111); line-height: $lh-label; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.persona-match-strip-v2 { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14rpx; align-items: center; border: var(--border-width, 2rpx) dashed var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface, #fff); padding: 14rpx; margin-top: 14rpx; margin-bottom: 18rpx; }
.persona-match-badge-v2 { display: inline-flex; align-items: center; justify-content: center; min-height: 44rpx; padding: 0 14rpx; border-radius: var(--shape-radius-control, 0); font-size: $fs-caption; font-weight: var(--font-weight-hero, $fw-hero); color: var(--text-main, #111); background: var(--surface, #fff); box-sizing: border-box; white-space: nowrap; }
.persona-match-badge-v2.great { background: var(--relation-good, #4ECDC4); }
.persona-match-badge-v2.good { background: var(--relation-mid, #FFD93D); }
.persona-match-badge-v2.caution { background: var(--relation-bad, #FF5252); color: var(--surface, #fff); }
.persona-match-desc-v2 { display: block; min-width: 0; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); line-height: $lh-body; }
.persona-dim-v2 { border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface, #fff); padding: 16rpx; margin-bottom: 14rpx; box-sizing: border-box; }
.persona-dim-label-v2 { display: inline-flex; align-items: center; background: var(--hero-tag-bg, #111); border-radius: var(--shape-radius-control, 0); color: var(--hero-tag-color, #FFD93D); font-size: $fs-caption; font-weight: var(--font-weight-hero, $fw-hero); padding: 4rpx 12rpx; margin-bottom: 10rpx; line-height: $lh-label; }
.persona-dim-text-v2 { display: block; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); line-height: $lh-body; }
.persona-dim-text-v2.strong { color: var(--text-main, #111); font-weight: var(--font-weight-heading, $fw-heading); font-size: $fs-body; line-height: $lh-label; }
.persona-dim-src-v2 { font-size: $fs-caption; color: var(--text-soft, #999); margin-top: 6rpx; display: block; line-height: $lh-label; }
.persona-match-tags-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 14rpx; align-items: center; }
.persona-match-label-v2 { font-size: $fs-caption; font-weight: var(--font-weight-hero, $fw-hero); color: var(--text-muted, #666); line-height: $lh-label; }
.persona-match-reason-v2 { display: inline; min-width: 180rpx; flex: 1; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-soft, #999); line-height: $lh-body; }

/* 引导卡 */
.guide-card-v2 { border-style: dashed; border-color: var(--text-soft, #999); cursor: pointer; }
.theme-strong-inline { color: var(--text-main, #111); font-weight: var(--font-weight-heading, $fw-heading); }

/* 匹配徽章 */
.pair-summary-v2 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8rpx; align-items: stretch; margin-top: 12rpx; }
.pair-role-v2 { display: block; min-width: 0; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); line-height: 1.2; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pair-role-mid-v2 { color: var(--text-main, #111); }
.pair-party-card-v2 { min-width: 0; border: var(--border-width, 2rpx) dashed var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--app-bg, #FFFDF5); padding: 8rpx; display: flex; flex-direction: column; gap: 8rpx; box-sizing: border-box; }
.pair-relation-stack-v2 { min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.pair-token-picker-v2 { width: 100%; min-width: 0; }
.pair-token-v2 { min-width: 0; width: 100%; min-height: 66rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--accent, #FFD93D); display: flex; align-items: center; justify-content: center; gap: 6rpx; padding: 0 8rpx; box-sizing: border-box; }
.pair-token-v2.alt { background: var(--brand-cool, #EAF7FF); }
.pair-token-v2.clickable { position: relative; padding-right: 32rpx; }
.pair-token-symbol-v2 { font-size: $fs-body; font-weight: $fw-body; color: var(--text-main, #111); line-height: 1; flex-shrink: 0; }
.pair-token-text-v2 { min-width: 0; font-size: $fs-body; font-weight: $fw-body; color: var(--text-main, #111); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pair-token-edit-v2 { position: absolute; right: 6rpx; top: 6rpx; width: 28rpx; height: 28rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-xs, 0); background: var(--surface, #fff); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.pair-basis-v2 { display: block; margin-top: 10rpx; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-soft, #888); text-align: center; }
.pair-relation-cell-v2 { min-width: 0; min-height: 66rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rpx 2rpx; box-sizing: border-box; }
.pair-relation-cell-v2.great { color: var(--relation-good, #0A8F86); }
.pair-relation-cell-v2.good { color: var(--relation-mid, #A87600); }
.pair-relation-cell-v2.caution { color: var(--relation-bad, #D33F49); }
.pair-relation-cell-v2.neutral { color: var(--relation-neutral, #111); }
.pair-relation-label-v2 { font-size: $fs-caption; font-weight: $fw-body; color: var(--text-soft, #777); line-height: 1.1; }
.pair-relation-value-v2 { max-width: 100%; margin-top: 3rpx; font-size: $fs-body; font-weight: $fw-body; color: inherit; line-height: 1.15; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pair-summary-desc-v2 { display: block; margin-top: 12rpx; text-align: left; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #666); line-height: $lh-body; }
.pair-preview-note-v2 { display: block; margin-top: 10rpx; padding: 12rpx 14rpx; border: var(--border-width, 2rpx) dashed var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface, #fff); font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); line-height: 1.45; }
.pair-preview-hint-v2 { display: block; margin-top: 16rpx; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-soft, #888); text-align: center; line-height: 1.45; }

.pair-extra-tags-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; justify-content: center; margin-top: 8rpx; }
.pair-extra-tag-v2 { display: inline-block; padding: 4rpx 14rpx; border: var(--border-width, 2rpx) solid var(--border, #111); font-size: $fs-caption; font-weight: $fw-label; color: var(--text-main, #111); background: var(--surface, #fff); }
.pair-extra-tag-v2.mbti { background: var(--mint-soft, #E0FFF0); }
.pair-extra-tag-v2.identity { background: var(--accent-soft, #FFFBEB); }

/* 全览表格 */
.overview-table-v2 { margin-top: 12rpx; }
.ov-row-v2 { display: flex; align-items: center; padding: 10rpx 0; border-bottom: 1rpx dashed var(--divider, #ccc); }
.ov-row-v2:last-child { border-bottom: none; }
.ov-row-v2.current { background: var(--brand-warm, #FFFBEB); margin: 0 -8rpx; padding: 12rpx 8rpx; border-radius: var(--shape-radius-inner, 4rpx); }
.ov-label-v2 { width: 130rpx; font-size: $fs-caption; font-weight: 900; color: var(--text-main, #111); flex-shrink: 0; }
.ov-dir-v2 { font-size: $fs-caption; font-weight: 600; color: var(--text-muted, #666); padding: 4rpx 12rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--surface-dim, #f9f9f9); margin: 0 4rpx; }
.ov-dir-v2.current { background: var(--accent, #FFD93D); color: var(--text-main, #111); font-weight: 800; }

/* 按钮 */
.btn-v2-me { display: flex; align-items: center; justify-content: center; height: 64rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); font-size: $fs-body-lg; font-weight: var(--font-weight-heading, $fw-heading); background: var(--surface, #fff); color: var(--text-main, #111); border-radius: var(--shape-radius-control, 0); }
.btn-v2-me.primary { background: var(--accent-cool, #4ECDC4); box-shadow: 4rpx 4rpx 0 var(--border, #111); }
.btn-v2-me.outline { background: var(--surface, #fff); }

/* Bottom Sheet */
.sheet-mask { position: fixed; inset: 0; background: var(--overlay, rgba(0,0,0,0.5)); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; }
.sheet-panel { width: 100%; max-width: 500rpx; background: var(--app-bg, #FFFDF5); border: var(--border-width-strong, 3rpx) solid var(--border, #111); box-shadow: var(--shadow-hero, 8rpx 8rpx 0 #111); border-radius: var(--shape-radius-card, 16rpx) var(--shape-radius-card, 16rpx) 0 0; padding: 28rpx 24rpx 60rpx; max-height: 70vh; overflow-y: auto; }
.sheet-head-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
.sheet-title-v2 { font-size: 36rpx; font-weight: 900; color: var(--text-main, #111); }
.sheet-close-v2 { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; color: var(--text-soft, #999); }

/* Picker */
.picker-stack-v2 { display: flex; flex-direction: column; gap: 12rpx; margin-bottom: 16rpx; }
.picker-card-v2 { width: 100%; min-height: 92rpx; border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: var(--shape-radius-card, 0); background: var(--surface, #fff); padding: 14rpx 16rpx; display: flex; align-items: center; justify-content: space-between; gap: 12rpx; box-sizing: border-box; }
.picker-card-main-v2 { min-width: 0; flex: 1; }
.picker-label-v2 { font-size: $fs-caption; font-weight: 700; color: var(--text-muted, #666); display: block; }
.picker-value-v2 { display: block; margin-top: 6rpx; font-size: $fs-body; font-weight: var(--font-weight-heading, $fw-heading); color: var(--text-main, #111); line-height: 1.25; word-break: break-all; }
.picker-action-v2 { flex-shrink: 0; width: 48rpx; height: 44rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--brand-warm, #FFFBEA); display: flex; align-items: center; justify-content: center; padding: 0; color: var(--text-main, #111); box-sizing: border-box; }
.sheet-actions-v2 { display: flex; gap: 12rpx; margin-top: 18rpx; }
.share-preview-image-v2 { width: 100%; border: var(--border-width-strong, 3rpx) solid var(--border, #111); border-radius: var(--shape-radius-card, 0); box-sizing: border-box; }

/* 双人解读 */
.pair-insight-v2 { margin-top: 16rpx; }
.pair-section-v2 { margin-bottom: 12rpx; }
.pair-label-v2 { font-size: $fs-body; font-weight: $fw-label; color: var(--text-main, #111); display: block; margin-bottom: 4rpx; }
.pair-label-row-v2 { margin-bottom: 4rpx; }
.pair-label-row-v2 .pair-label-v2 { margin-bottom: 0; }
.pair-text-v2 { font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #666); display: block; line-height: 1.5; }
.pair-text-v2.muted { color: var(--text-soft, #999); font-size: $fs-caption; }
.pair-classical-v2 { font-size: $fs-caption; color: var(--text-soft, #999); display: block; line-height: 1.45; }

/* 桃花指数条 */
.score-bar-v2 { margin-bottom: 16rpx; }
.score-head-v2 { display: flex; align-items: baseline; gap: 8rpx; margin-bottom: 8rpx; }
.score-num-v2 { font-size: 50rpx; font-weight: 900; color: var(--text-main, #111); line-height: 1; }
.score-unit-v2 { font-size: $fs-caption; font-weight: $fw-label; color: var(--text-soft, #999); }
.score-track-v2 { height: 14rpx; background: var(--surface-dim, #e8e8e8); border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-xs, 0); overflow: hidden; }
.score-fill-v2 { height: 100%; background: var(--accent, #FFD93D); transition: width 0.6s ease; }

/* 行动指南 */
.action-guide-card-v2 { background: var(--brand-warm, #FFFBEB); }
.action-guide-hero-v2 { padding: 20rpx 0 18rpx; border-bottom: var(--border-width-strong, 3rpx) dashed var(--divider-strong, #111); }
.action-guide-main-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-main, #111); line-height: 1.45; }
/* 后端文本 emoji → SVG 混排 */
.emoji-mix-v2 { display: flex; flex-wrap: wrap; align-items: center; gap: 2rpx; }
.emoji-icon-v2 { width: 32rpx; height: 32rpx; flex-shrink: 0; }
.action-score-v2 { margin-top: 14rpx; }
.action-score-head-v2 { display: flex; align-items: baseline; gap: 8rpx; }
.action-score-note-v2 { display: block; margin-top: 8rpx; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.45; }
.action-boost-v2 { display: inline-flex; align-items: center; gap: 6rpx; margin-top: 12rpx; padding: 6rpx 14rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--risk, #FF5252); color: var(--surface, #fff); font-size: $fs-caption; font-weight: var(--font-weight-heading, $fw-heading); box-sizing: border-box; }
.action-guide-section-v2 { padding: 18rpx 0; border-bottom: 2rpx dashed var(--divider, rgba(17,17,17,.22)); }
.action-guide-section-v2:last-child { border-bottom: none; padding-bottom: 0; }
.action-guide-body-v2 { padding-left: 32rpx; }
.action-guide-section-title-v2 { display: flex; align-items: center; gap: 8rpx; margin-bottom: 12rpx; font-size: $fs-body; font-weight: $fw-label; color: var(--text-main, #111); }
.action-dir-grid-v2 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8rpx; }
.action-dir-card-v2 { min-width: 0; padding: 14rpx 8rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface, #fff); text-align: center; box-sizing: border-box; }
.action-dir-name-v2 { display: block; font-size: $fs-caption; font-weight: $fw-label; color: var(--text-muted, #666); line-height: 1.2; }
.action-dir-value-v2 { display: block; margin-top: 6rpx; font-size: $fs-body; font-weight: var(--font-weight-heading, $fw-heading); color: var(--text-main, #111); line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.action-dir-value-v2.hongluan { color: var(--taohua-hongluan, #FF5252); }
.action-dir-value-v2.tianxi { color: var(--taohua-tianxi, #0A8F86); }
.action-dir-use-v2 { display: block; margin-top: 8rpx; font-size: $fs-caption; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.35; }
.action-vibe-v2 { display: flex; align-items: center; gap: 10rpx; margin-top: 12rpx; padding: 12rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--surface, #fff); box-sizing: border-box; }
.action-vibe-label-v2 { flex-shrink: 0; padding: 4rpx 10rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--accent-cool, #4ECDC4); font-size: $fs-caption; font-weight: $fw-label; color: var(--text-main, #111); }
.action-vibe-text-v2 { min-width: 0; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.45; }
.action-tag-row-v2 { display: flex; flex-wrap: wrap; gap: 8rpx; margin: 10rpx 0 12rpx; }
.action-line-list-v2 { display: flex; flex-direction: column; gap: 8rpx; }
.action-guide-line-v2 { display: grid; grid-template-columns: 58rpx 1fr; gap: 10rpx; align-items: flex-start; padding: 12rpx; border: var(--border-width, 2rpx) solid transparent; border-radius: var(--shape-radius-inner, 0); background: var(--surface, #fff); box-sizing: border-box; }
.action-guide-line-v2.good { border-color: var(--border, #111); background: var(--onboard-primary-bg, #f7fffd); }
.action-guide-line-v2.warn { border-color: var(--border, #111); background: var(--risk-soft, #fff5f2); }
.action-guide-pill-v2 { display: inline-flex; align-items: center; justify-content: center; min-height: 28rpx; border: var(--border-width, 2rpx) solid var(--border, #111); border-radius: var(--shape-radius-control, 0); background: var(--accent, #FFD93D); font-size: $fs-caption; font-weight: $fw-label; color: var(--text-main, #111); }
.action-guide-pill-v2.warn { background: var(--risk, #FF5252); color: var(--surface, #fff); }
.action-guide-line-text-v2 { min-width: 0; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #666); line-height: 1.45; }
.action-wear-main-v2 { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-main, #111); line-height: 1.45; }
.action-wear-note-v2 { display: block; margin-top: 8rpx; font-size: $fs-caption; font-weight: $fw-body; color: var(--text-soft, #999); line-height: 1.45; }
.guide-section-v2 { display: flex; gap: 14rpx; padding: 16rpx 0; border-bottom: 1rpx dashed var(--divider, #ddd); }
.guide-section-v2:last-child { border-bottom: none; }
.guide-icon-v2 { flex-shrink: 0; width: 52rpx; height: 52rpx; display: flex; align-items: center; justify-content: center; }
.guide-content-v2 { flex: 1; }
.guide-label-v2 { font-size: $fs-body; font-weight: $fw-label; color: var(--text-main, #111); display: block; margin-bottom: 4rpx; }
.guide-text-v2 { font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #666); display: block; line-height: 1.4; }
.guide-text-v2.strong { color: var(--text-main, #111); font-weight: $fw-label; }

/* 古籍出处 */
.cite-block-v2 { margin-top: 14rpx; padding: 10rpx 14rpx; background: var(--brand-warm, #FFFBEB); border-left: 4rpx solid var(--accent, #FFD93D); border-radius: var(--shape-radius-inner, 0); }
.cite-title-v2 { font-size: $fs-caption; font-weight: 900; color: var(--text-main, #111); display: block; }
.cite-desc-v2 { font-size: $fs-caption; color: var(--text-soft, #999); display: block; line-height: 1.5; margin-top: 2rpx; }
.cite-inline-v2 { font-size: $fs-caption; font-weight: 700; color: var(--text-soft, #bbb); margin-left: 4rpx; }

/* 免责声明 */
.disclaimer-card-v2 { border-style: dashed; background: var(--brand-warm, #FFFBEB); }
.disclaimer-lines-v2 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  text-align: center;
}
.disclaimer-head-v2 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}
.ai-disclaimer { text-align: center; padding: 20rpx 20rpx 40rpx; }
.ai-disclaimer-text { font-size: $fs-caption; color: var(--text-soft, #999); }
.go-home-link { display: block; margin-top: 12rpx; font-size: $fs-body; font-weight: var(--font-weight-hero, $fw-hero); color: var(--text-main, #111); text-decoration: underline; text-align: center; }

/* 桃花匹配度 AI 深度解读盒（自 case-detail 移植） */
.action-box { margin-top: 12rpx; padding: 14rpx; border: var(--border-width, 2rpx) dashed var(--border, #111); border-radius: var(--shape-radius-inner, 0); background: var(--brand-cool, #f5f5ff); }
.action-label { display: block; font-size: $fs-caption; font-weight: 900; color: var(--text-main, #111); text-transform: uppercase; letter-spacing: 2rpx; margin-bottom: 8rpx; }
.action-text { display: block; font-size: $fs-body; font-weight: $fw-body; color: var(--text-muted, #555); line-height: 1.5; }
.action-text.advice { margin-top: 6rpx; font-weight: var(--font-weight-heading, $fw-heading); color: var(--text-main, #111); }
.action-text.muted { color: var(--text-soft, #999); }
.ai-row { display: flex; align-items: center; gap: 14rpx; }
.ai-dot { width: 20rpx; height: 20rpx; border: var(--border-width, 2rpx) solid var(--border, #111); background: var(--accent, #FFD93D); display: inline-block; animation: blink-dot 1s ease-in-out infinite; }
@keyframes blink-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.75); }
}

/* Global typography alignment: keep this page on the shared token scale. */
.hero-tag-v2,
.tag-v2,
.tag-v2.sm,
.mini-action-v2,
.pair-role-v2,
.ov-label-v2,
.ov-dir-v2,
.picker-label-v2,
.cite-title-v2,
.cite-desc-v2,
.cite-inline-v2,
.ai-disclaimer-text,
.action-label,
.caption-note-v2,
.inline-caption-note-v2 {
  font-size: $fs-caption;
}

.hero-title-v2 {
  font-size: $fs-hero-title;
  font-weight: var(--font-weight-hero, $fw-hero);
  color: var(--text-main, #111);
  letter-spacing: 0;
}

.section-title-v2,
.info-sheet-title,
.sheet-title-v2 {
  font-size: $fs-heading;
  font-weight: var(--font-weight-heading, $fw-heading);
  color: var(--text-main, #111);
}

.pair-label-v2,
.guide-label-v2,
.action-guide-section-title-v2,
.card-text-v2.strong {
  font-size: $fs-body;
  font-weight: $fw-label;
  color: var(--text-main, #111);
}

.hero-copy-v2,
.card-text-v2,
.guide-text-v2,
.pair-text-v2,
.action-text,
.action-guide-main-v2,
.action-wear-main-v2,
.pair-summary-desc-v2,
.pair-preview-note-v2,
.pair-preview-hint-v2 {
  font-size: $fs-body;
  font-weight: $fw-body;
  color: var(--text-muted, #666);
  line-height: $lh-body;
}

.card-text-v2.muted,
.pair-text-v2.muted,
.persona-dim-src-v2,
.info-tree-note,
.pair-basis-v2 {
  font-size: $fs-caption;
  color: var(--text-soft, #999);
}

.dir-val-v2,
.persona-mini-symbol-v2,
.persona-mini-label-v2,
.pair-token-symbol-v2,
.pair-token-text-v2,
.pair-relation-value-v2,
.picker-value-v2 {
  font-size: $fs-body;
  font-weight: $fw-body;
}

.score-unit-v2 {
  font-size: $fs-caption;
  font-weight: $fw-label;
}

.score-num-v2 {
  font-size: $fs-display;
}

.btn-v2-me {
  font-size: $fs-body-lg;
  font-weight: $fw-heading;
}

.inline-caption-note-v2 {
  display: inline;
  margin-left: 6rpx;
}
</style>
