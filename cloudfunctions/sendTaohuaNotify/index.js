/**
 * sendTaohuaNotify — 每日桃花运势推送
 *
 * 定时触发（建议每天早上 7:55），向已订阅用户推送：
 *   今日桃花方位 + 宜忌 + 穿戴建议
 *
 * 前置条件：
 *   1. 微信小程序已认证
 *   2. 在微信后台申请订阅消息模板（模板关键词：方位/宜/忌/穿搭）
 *   3. 在 CloudBase 数据库创建 taohua_subscriptions 集合
 *   4. 将模板 ID 配置到 cloudbaserc.json 的环境变量中
 */
const { Solar } = require('lunar-javascript')
const cloudbase = require('@cloudbase/node-sdk')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

// ── 模板配置（部署时替换为实际模板ID） ──
const TMPL_ID = process.env.WX_SUBSCRIBE_TMPL_ID || ''

// ── 快速计算 ──
function buildNotifyData() {
  const solar = Solar.fromDate(new Date())
  const lunar = solar.getLunar()

  const dayZhi = lunar.getDayZhi()
  const zhiWuxing = { '寅':'木','卯':'木','巳':'火','午':'火','申':'金','酉':'金','亥':'水','子':'水','辰':'土','未':'土','戌':'土','丑':'土' }
  const wuxing = zhiWuxing[dayZhi] || '火'

  const WEAR = {
    '金': { colors: ['白色','银色'], tip: '戴银色项链或白水晶手串' },
    '木': { colors: ['绿色','青色'], tip: '戴木质手串或绿色发饰' },
    '水': { colors: ['黑色','深蓝'], tip: '戴黑曜石或珍珠耳钉' },
    '火': { colors: ['红色','紫色'], tip: '涂个红唇或戴红绳手链' },
    '土': { colors: ['黄色','棕色'], tip: '搭个棕色包包或黄水晶吊坠' },
  }
  const wear = WEAR[wuxing] || WEAR['火']

  const taohuaMap = { '子':'正北','丑':'东北偏北','寅':'东北偏东','卯':'正东','辰':'东南偏东','巳':'东南偏南','午':'正南','未':'西南偏南','申':'西南偏西','酉':'正西','戌':'西北偏西','亥':'西北偏北' }
  const taohuaDir = taohuaMap[dayZhi] || '正南'

  const loveGood = ['嫁娶','纳采','订婚','出行','会友','安床']
  const loveBad = ['嫁娶','词讼']
  const yiList = (lunar.getDayYi() || []).filter(y => loveGood.includes(y))
  const jiList = (lunar.getDayJi() || []).filter(j => loveBad.includes(j))
  const yiStr = yiList.length ? yiList.slice(0, 2).join('、') : '—'
  const jiStr = jiList.length ? jiList.slice(0, 2).join('、') : '—'

  // 桃花指数
  const jianchu = lunar.getZhiXing()
  const weights = { '成':30,'开':30,'满':20,'定':15,'除':15,'建':10,'平':0,'收':-5,'执':-10,'危':-15,'破':-30,'闭':-30 }
  let score = 50 + (weights[jianchu] || 0)
  if ((lunar.getDayYi()||[]).includes('嫁娶')) score += 10
  if ((lunar.getDayJi()||[]).includes('嫁娶')) score -= 15
  score = Math.max(0, Math.min(100, score))

  return {
    date: solar.toYmd(),
    lunarDate: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    taohuaDir,
    yiStr,
    jiStr,
    wearColor: wear.colors[0],
    wearTip: wear.tip,
    score,
    oneliner: `${taohuaDir} ${wear.colors[0]}色 ${yiStr} ${score}分`,
  }
}

function buildMsgData(notify) {
  return {
    thing1: { value: notify.taohuaDir },           // 今日桃花方位
    thing2: { value: notify.yiStr },               // 宜
    thing3: { value: notify.jiStr },               // 忌
    thing4: { value: `${notify.wearColor}色 ${notify.wearTip}` }, // 穿搭
  }
}

exports.main = async (event, context) => {
  // 计算今日数据（所有用户共享）
  const notify = buildNotifyData()

  // 获取所有活跃订阅
  let subscriptions = []
  try {
    const res = await db.collection('taohua_subscriptions')
      .where({ active: true })
      .limit(500)
      .get()
    subscriptions = res.data || []
  } catch (e) {
    return { success: false, message: '获取订阅列表失败', error: e.message }
  }

  if (!subscriptions.length) {
    return { success: true, message: '无活跃订阅', sent: 0 }
  }

  // 逐个发送
  let sent = 0
  let failed = 0
  const msgData = buildMsgData(notify)

  for (const sub of subscriptions) {
    try {
      await cloudbase.openapi.subscribeMessage.send({
        touser: sub.openid,
        templateId: TMPL_ID,
        page: 'pages/taohua/taohua',
        data: msgData,
        miniprogramState: 'formal',
      })
      sent++
      // 更新最后发送时间
      await db.collection('taohua_subscriptions').doc(sub._id).update({
        lastSentAt: new Date().toISOString(),
        lastScore: notify.score,
      })
    } catch (e) {
      failed++
      // 如果用户取消订阅，标记为失效
      if (e.errCode === 43101) {
        await db.collection('taohua_subscriptions').doc(sub._id).update({ active: false })
      }
    }
  }

  return { success: true, message: `推送完成`, sent, failed, date: notify.date }
}
