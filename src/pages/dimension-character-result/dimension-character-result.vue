<template>
  <view class="page" :style="themeVars">
    <view v-if="loading" class="card">正在读取结果...</view>
    <view v-else-if="errorMessage" class="card error">{{ errorMessage }}</view>
    <template v-else-if="result && primary">
      <view class="hero">
        <text class="eyebrow">TOP MATCH</text>
        <image v-if="primary.coverUrl" :src="primary.coverUrl" mode="aspectFill" class="avatar" />
        <view v-else class="avatar">{{ primary.name.slice(0,1) }}</view>
        <text class="title">{{ result.mode==='target'?'TA':'你' }}最像「{{ primary.name }}」</text>
        <text class="score">{{ result.similarities[result.primaryPersonKey] }}%</text>
        <text class="summary">{{ summary(primary) }}</text>
      </view>
      <view v-if="secondary" class="card secondary-card"><text class="card-title">双原型组合</text><text>第二像「{{ secondary.name }}」{{ result.similarities[result.secondaryPersonKey] }}%</text></view>
      <view class="card"><text class="card-title">五维关系画像</text><view v-for="dimension in dimensions" :key="dimension.key" class="dimension"><view><text>{{ dimension.name }}</text><text>{{ result.dimensions[dimension.key] }}%</text></view><view class="track"><view class="fill" :style="{width:result.dimensions[dimension.key]+'%'}" /></view></view></view>
      <view class="card"><text class="card-title">为什么像</text><text v-for="item in whyMatched" :key="item.key" class="copy-line">你们在「{{ item.name }}」上的表现最接近，差值 {{ item.diff }} 分。</text></view>
      <view class="card watch"><text class="card-title">可以继续观察</text><text v-for="item in watchSignals" :key="item.key" class="copy-line">· {{ item.text }}</text></view>
      <view class="card"><text class="card-title">前五名人</text><view v-for="(item,index) in result.topFive" :key="item.personKey" class="rank" @click="openPerson(item.personKey)"><text>{{ index+1 }} · {{ item.name }}</text><text>{{ item.similarity }}%</text></view></view>
      <text v-if="result.mode==='target'" class="confidence">观察覆盖 {{ result.answeredCount }}/12 · {{ confidenceText }}</text>
      <button class="primary" @click="retest">重新测试</button><button class="secondary" open-type="share">分享结果</button>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed,ref } from 'vue'
import { onLoad,onShareAppMessage,onShow } from '@dcloudio/uni-app'
import { getArchetypeQuestionBank,getArchetypeResults } from '@/utils/api'
import { FEATURE_DIMENSION_CHARACTER } from '@/utils/feature-keys'
import { buildCelebrityShareCopy, buildCelebritySummary } from '@/utils/crush-celebrity-copy'
import { applyThemeChrome, getThemeStyle } from '@/utils/theme'
const themeVars=ref(getThemeStyle())
const loading=ref(true),errorMessage=ref(''),resultId=ref(''),result=ref<any>(null),content=ref<any>(null)
const primary=computed(()=>content.value?.people?.find((p:any)=>p.key===result.value?.primaryPersonKey))
const secondary=computed(()=>content.value?.people?.find((p:any)=>p.key===result.value?.secondaryPersonKey))
const runnerUp=computed(()=>content.value?.people?.find((p:any)=>p.key===result.value?.topFive?.[1]?.personKey))
const dimensions=computed(()=>content.value?.dimensions||[])
const confidenceText=computed(()=>({high:'观察充分',medium:'观察中等',low:'观察较少'} as any)[result.value?.observationConfidence]||'')
const whyMatched=computed(()=>{if(!primary.value||!result.value)return[];return dimensions.value.map((d:any)=>({key:d.key,name:d.name,diff:Math.abs(result.value.dimensions[d.key]-primary.value.profile[d.key])})).sort((a:any,b:any)=>a.diff-b.diff).slice(0,3)})
const watchSignals=computed(()=>{if(!primary.value)return[];return [...dimensions.value].sort((a:any,b:any)=>primary.value.profile[a.key]-primary.value.profile[b.key]).slice(0,2).map((d:any)=>({key:d.key,text:content.value.resultCopy[d.key].low}))})
function summary(person:any){return buildCelebritySummary(person,dimensions.value,content.value?.resultCopy||{})}
async function load(){try{if(!resultId.value)throw new Error('缺少测试结果 ID');const history=await getArchetypeResults({kind:'dimension_character',resultId:resultId.value,limit:1});result.value=(history?.results||[]).find((item:any)=>item?._id===resultId.value);if(!result.value)throw new Error('结果不存在');const bank=await getArchetypeQuestionBank(FEATURE_DIMENSION_CHARACTER,result.value.contentVersion);if(!bank?.success)throw new Error(bank?.message||'题库读取失败');content.value=bank.bank.content}catch(error:any){errorMessage.value=error?.message||'读取失败'}finally{loading.value=false}}
function openPerson(key:string){uni.navigateTo({url:`/pages/dimension-character-person/dimension-character-person?personKey=${key}`})}
function retest(){uni.redirectTo({url:`/pages/dimension-character/dimension-character?mode=${result.value.mode}${result.value.caseId?`&caseId=${result.value.caseId}`:''}`})}
onLoad((options:any)=>{resultId.value=String(options?.id||'');load()})
onShow(()=>{themeVars.value=getThemeStyle();applyThemeChrome()})
onShareAppMessage(()=>({title:buildCelebrityShareCopy({mode:result.value?.mode,primary:primary.value,primarySimilarity:result.value?.similarities?.[result.value?.primaryPersonKey]||0,secondary:runnerUp.value,secondarySimilarity:result.value?.topFive?.[1]?.similarity||0,template:content.value?.resultCopy?.shareTemplate}),path:'/pages/dimension-character/dimension-character?mode=self'}))
</script>

<style scoped lang="scss">
@import '@/styles/campus-pop.scss';
.page{min-height:100vh;padding:28rpx;background:var(--app-bg, #FFFDF5);color:var(--text-main, #111)}.hero,.card{margin-bottom:24rpx;padding:30rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-card, 0);background:var(--surface, #fff);box-shadow:var(--shadow-hero, 8rpx 8rpx 0 #111)}.hero{text-align:center;background:var(--hero-bg, #FF6B6B)}.eyebrow{font-weight:$fw-label;letter-spacing:3rpx;font-size:$fs-micro}.avatar{display:flex;align-items:center;justify-content:center;width:150rpx;height:150rpx;margin:20rpx auto;border:5rpx solid var(--border, #111);border-radius:50%;background:var(--surface, #fff);font-size:$fs-hero-title;font-weight:var(--font-weight-hero, $fw-hero)}.title{display:block;font-size:$fs-heading;font-weight:var(--font-weight-hero, $fw-hero)}.score{display:block;font-size:$fs-display;font-weight:var(--font-weight-hero, $fw-hero)}.summary{line-height:1.5;font-size:$fs-body}.card-title{display:block;margin-bottom:14rpx;font-size:$fs-heading;font-weight:var(--font-weight-heading, $fw-heading)}.secondary-card{background:var(--risk-soft, #FFEEEC)}.dimension>view:first-child,.rank{display:flex;justify-content:space-between;margin-top:14rpx;font-weight:var(--font-weight-heading, $fw-heading)}.track{height:14rpx;margin-top:8rpx;border:var(--border-width, 2rpx) solid var(--border, #111);border-radius:var(--shape-radius-xs, 0);overflow:hidden}.fill{height:100%;background:var(--accent, #FFD93D)}.rank{padding:14rpx;border-bottom:2rpx dashed var(--divider, #aaa)}.copy-line{display:block;margin-top:10rpx;line-height:1.5;font-size:$fs-body}.watch{background:var(--brand-warm, #FFFBEB)}.confidence{display:block;text-align:center;color:var(--text-muted, #666);font-size:$fs-caption}.primary,.secondary{margin-top:20rpx;border:var(--border-width-strong, 3rpx) solid var(--border, #111);border-radius:var(--shape-radius-control, 0);box-shadow:var(--shadow-hard, 4rpx 4rpx 0 #111)}.primary{background:var(--accent-cool, #4ECDC4)}.secondary{background:var(--surface, #fff)}.error{background:var(--risk-soft, #FFEEEC)}
</style>
