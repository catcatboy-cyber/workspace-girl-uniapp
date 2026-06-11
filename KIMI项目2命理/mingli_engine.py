"""
命理引擎主入口（重构版）
底层日历：lunar-python（MIT协议，寿星天文历算法）
上层规则：自研算法，直接译自古籍原文
  《三命通会》—— 咸池桃花 + 红鸾天喜
  《协纪辨方书》—— 神煞方位 + 宜忌择吉
  《果老星宗》—— 星座星次映射
"""

import datetime
from lunar_python import Solar, Lunar

from rules.taohua import (
    zodiac_to_taohua, hongluan_tianxi, xianchi_algorithm,
    ZODIAC_NAMES, ZODIAC_TO_ZHI, ZHI_TO_ZODIAC, ZHI_TO_DIRECTION,
)
from rules.xingzuo import zodiac_sign_match, SIGN_DUAL


def _get_lunar(g_date=None):
    """获取 lunar-python Lunar 对象（统一入口）"""
    if g_date is None:
        g_date = datetime.datetime.now()
    elif isinstance(g_date, datetime.date) and not isinstance(g_date, datetime.datetime):
        g_date = datetime.datetime(g_date.year, g_date.month, g_date.day, 12, 0, 0)
    return Solar.fromDate(g_date).getLunar()


def _match_sign(input_sign):
    """模糊匹配星座名"""
    for s in SIGN_DUAL:
        if input_sign in s or s.startswith(input_sign):
            return s
    return None


# ============================================================
# 每日方位（直接走 lunar-python）
# ============================================================

def daily_fangwei(g_date=None):
    """每日神煞方位 — 底层走 lunar-python，数据来源《协纪辨方书》"""
    l = _get_lunar(g_date)
    return {
        "公历日期": str(l.getSolar().toFullString()),
        "农历": f"{l.getYearInChinese()}年{l.getMonthInChinese()}月{l.getDayInChinese()}",
        "日柱": l.getDayInGanZhi(),
        "日干": l.getDayInGanZhi()[0],
        "日支": l.getDayInGanZhi()[1],
        "生肖日冲": l.getDayChongDesc(),
        "煞方": l.getDaySha(),
        "喜神": {"卦": l.getDayPositionXi(), "方位": l.getDayPositionXiDesc()},
        "财神": {"卦": l.getDayPositionCai(), "方位": l.getDayPositionCaiDesc()},
        "福神": {"卦": l.getDayPositionFu(), "方位": l.getDayPositionFuDesc()},
        "阳贵": {"卦": l.getDayPositionYangGui(), "方位": l.getDayPositionYangGuiDesc()},
        "阴贵": {"卦": l.getDayPositionYinGui(), "方位": l.getDayPositionYinGuiDesc()},
        "胎神": l.getDayPositionTai(),
        "彭祖百忌": f"{l.getPengZuGan()}；{l.getPengZuZhi()}",
        "二十八宿": f"{l.getXiu()}{l.getZheng()}{l.getAnimal()}（{l.getGong()}{l.getShou()}）",
    }


# ============================================================
# 每日宜忌（直接走 lunar-python）
# ============================================================

def daily_yiji(g_date=None):
    """每日宜忌 + 吉神凶煞 — 底层走 lunar-python"""
    l = _get_lunar(g_date)
    return {
        "建除": l.getZhiXing(),
        "宜": l.getDayYi(),
        "忌": l.getDayJi(),
        "吉神": l.getDayJiShen(),
        "凶煞": l.getDayXiongSha(),
    }


# ============================================================
# 节气信息（lunar-python 精确计算）
# ============================================================

def jieqi_info(g_date=None):
    """当前节气 + 下一个节气"""
    l = _get_lunar(g_date)
    return {
        "当前节气": l.getJieQi(),
        "下一节气": l.getNextJieQi(),
        "农历月": f"{l.getYearInChinese()}年{l.getMonthInChinese()}月",
        "年柱": f"{l.getYearInGanZhi()} {l.getYearShengXiao()}年",
        "月柱": l.getMonthInGanZhi(),
    }


# ============================================================
# 主查询接口
# ============================================================

def query_love_report(zodiac: str, sign: str) -> dict:
    """
    输入生肖 + 星座 → 输出完整桃花感情分析报告。
    """
    # 验证生肖
    if zodiac not in ZODIAC_TO_ZHI:
        return {"error": f"未知生肖: {zodiac}", "valid": ZODIAC_NAMES}

    # 模糊匹配星座
    matched = _match_sign(sign)
    if not matched:
        return {"error": f"未知星座: {sign}",
                "valid": list(SIGN_TAOHUA_PROPERTY.keys())}
    sign = matched

    # 1. 本命桃花（自研算法，基于出生年生肖）
    taohua = zodiac_to_taohua(zodiac)

    # 2. 本命红鸾天喜（自研算法，基于出生年生肖）
    hongluan = hongluan_tianxi(zodiac)

    # 3. 属相 × 星座交叉（自研算法）
    cross = zodiac_sign_match(zodiac, sign)

    # 4. 星座双维度数据（中国传统星次 + 西方传统星座）
    sign_dual = SIGN_DUAL.get(sign, {})

    # 5. 今日方位（lunar-python）
    fangwei = daily_fangwei()

    # 6. 今日宜忌（lunar-python）
    yiji = daily_yiji()

    # 7. 节气（lunar-python）
    jieqi = jieqi_info()

    # 8. 提取当前年月日地支 → 计算流年/流月/流日动态桃花
    year_zhi = jieqi["年柱"].split()[0][-1]   # "丙午 马年" → "午"
    month_zhi = jieqi["月柱"][-1]              # "甲午" → "午"
    day_zhi = fangwei["日支"]                  # "丑"

    year_taohua = xianchi_algorithm(year_zhi)
    month_taohua = xianchi_algorithm(month_zhi)
    day_taohua = xianchi_algorithm(day_zhi)

    year_hl = hongluan_tianxi(year_zhi)
    month_hl = hongluan_tianxi(month_zhi)
    day_hl = hongluan_tianxi(day_zhi)

    # 9. 判断今日是否为天喜日（日支与月建六合）
    LIUHE = {"子": "丑", "丑": "子", "寅": "亥", "亥": "寅",
             "卯": "戌", "戌": "卯", "辰": "酉", "酉": "辰",
             "巳": "申", "申": "巳", "午": "未", "未": "午"}
    month_zhi_for_tianxi = jieqi["月柱"][-1]  # "甲午" → "午"
    is_tianxi_day = LIUHE.get(day_zhi) == month_zhi_for_tianxi

    # 10. 桃花指数
    taohua_score = _calc_taohua_score(
        yiji["建除"], day_taohua["direction"],
        fangwei["喜神"]["方位"], is_tianxi_day, yiji
    )

    # 11. 今日行动指南（通俗落地版）
    practical_guide = _build_practical_guide(
        day_taohua["wuxing"], day_taohua["direction"], yiji, fangwei, zodiac,
        yiji["建除"], taohua_score["分数"]
    )

    # 10. 综合感情建议（整合本命+动态信息）
    recommendations = _build_recommendations(
        zodiac, taohua, hongluan, fangwei, yiji,
        year_taohua, month_taohua, day_taohua,
        year_hl, month_hl, day_hl,
    )

    return {
        "元数据": {
            "规则来源": [
                "《三命通会》— 咸池桃花、红鸾天喜",
                "《协纪辨方书》— 神煞方位、宜忌择吉（日历计算）",
                "《果老星宗》— 星次星座映射",
                "lunar-python（MIT）— 寿星天文历底层的干支/节气/建除/星宿",
            ],
            "查询时间": datetime.datetime.now().isoformat(),
            "生肖": zodiac,
            "星座": sign,
            "当前干支": {
                "流年": f"{jieqi['年柱']}（年支：{year_zhi}）",
                "流月": f"{jieqi['月柱']}（月支：{month_zhi}）",
                "流日": f"{fangwei['日柱']}（日支：{day_zhi}）",
            },
        },
        "节气": jieqi,
        "本命桃花": taohua,
        "本命红鸾天喜": hongluan,
        "流年桃花": year_taohua,
        "流月桃花": month_taohua,
        "流日桃花": day_taohua,
        "流年红鸾天喜": year_hl,
        "流月红鸾天喜": month_hl,
        "流日红鸾天喜": day_hl,
        "属相星座交叉": cross,
        "星座双维度": sign_dual,
        "今日方位": fangwei,
        "今日宜忌": yiji,
        "桃花指数": taohua_score,
        "今日行动指南": practical_guide,
        "综合建议": recommendations,
    }


def _build_recommendations(zodiac, taohua, hongluan, fangwei, yiji,
                          year_taohua, month_taohua, day_taohua,
                          year_hl, month_hl, day_hl):
    """综合各模块信息生成建议（含流年/流月/流日动态桃花）"""
    recs = []

    # ── 本命桃花（终身） ──
    if "error" not in taohua:
        recs.append({
            "类型": "本命桃花位（咸池·终身）",
            "方位": taohua["direction"],
            "说明": taohua["direction_desc"],
            "优先级": "终身布局",
        })

    # ── 本命红鸾天喜（终身） ──
    recs.append({
        "类型": "本命红鸾位（终身）",
        "方位": hongluan["hongluan"]["direction"],
        "说明": hongluan["hongluan"]["meaning"],
        "催旺方法": hongluan["hongluan"]["cuiwang"],
        "优先级": "日常布局",
    })
    recs.append({
        "类型": "本命天喜位（终身）",
        "方位": hongluan["tianxi"]["direction"],
        "说明": hongluan["tianxi"]["meaning"],
        "催旺方法": hongluan["tianxi"]["cuiwang"],
        "优先级": "谈婚论嫁优先",
    })

    # ── 流年红鸾天喜（今年） ──
    year_hongluan_dir = year_hl["hongluan"]["direction"]
    year_tianxi_dir = year_hl["tianxi"]["direction"]
    recs.append({
        "类型": "流年红鸾位（今年）",
        "方位": year_hongluan_dir,
        "说明": f"今年红鸾在{year_hongluan_dir}，是本年正缘桃花最旺的方位。",
        "催旺方法": year_hl["hongluan"]["cuiwang"],
        "优先级": "今年重点",
    })
    recs.append({
        "类型": "流年天喜位（今年）",
        "方位": year_tianxi_dir,
        "说明": f"今年天喜在{year_tianxi_dir}，宜求婚、订婚、确定关系。",
        "催旺方法": year_hl["tianxi"]["cuiwang"],
        "优先级": "今年重点",
    })

    # ── 流月红鸾天喜（本月） ──
    month_hongluan_dir = month_hl["hongluan"]["direction"]
    month_tianxi_dir = month_hl["tianxi"]["direction"]
    recs.append({
        "类型": "流月红鸾位（本月）",
        "方位": month_hongluan_dir,
        "说明": f"本月红鸾在{month_hongluan_dir}，本月约会社交优先此方位。",
        "催旺方法": month_hl["hongluan"]["cuiwang"],
        "优先级": "本月优先",
    })
    recs.append({
        "类型": "流月天喜位（本月）",
        "方位": month_tianxi_dir,
        "说明": f"本月天喜在{month_tianxi_dir}，本月婚庆事宜选此方位吉利。",
        "催旺方法": month_hl["tianxi"]["cuiwang"],
        "优先级": "本月参考",
    })

    # ── 流日桃花（今天） ──
    day_taohua_dir = day_taohua["direction"]
    recs.append({
        "类型": "今日桃花位（流日咸池）",
        "方位": day_taohua_dir,
        "说明": f"今日桃花在{day_taohua_dir}（日支{day_taohua['taohua_zhi']}的沐浴位），今日约会、社交选此方位最佳。",
        "优先级": "今日执行",
    })

    # ── 今日喜神方位（约会首选） ──
    recs.append({
        "类型": "今日约会方位（喜神）",
        "方位": fangwei["喜神"]["方位"],
        "说明": f"今日喜神在{fangwei['喜神']['方位']}，约会社交宜选此方位。"
               f"贵人白天在{fangwei['阳贵']['方位']}，遇事不决朝此方向。",
        "优先级": "今日执行",
    })

    # ── 今日宜忌摘要 ──
    love_keywords = ["嫁娶", "纳采", "订婚", "出行", "会友", "安床",
                     "纳财", "入宅", "立约", "祭祀"]
    yi_love = [y for y in yiji["宜"] if y in love_keywords]
    ji_love = [j for j in yiji["忌"] if j in love_keywords]
    if yi_love:
        recs.append({"类型": "今日宜（感情相关）", "事项": yi_love, "优先级": "今日参考"})
    if ji_love:
        recs.append({"类型": "今日忌（感情相关）", "事项": ji_love, "优先级": "今日注意"})

    return recs


# ============================================================
# 桃花指数（0-100 综合评分）
# ============================================================

def _calc_taohua_score(jianchu, day_taohua_dir, xishen_dir, is_tianxi_day, yiji):
    """
    综合计算今日桃花指数。
    基础分 50，各项加减。
    """
    score = 50
    reasons = []

    # 建除加权
    jianchu_weights = {
        "成": (30, "成日最吉"),
        "开": (30, "开日大吉"),
        "满": (20, "满日丰收"),
        "定": (15, "定日安稳"),
        "除": (15, "除日翻新"),
        "建": (10, "建日开始"),
        "平": (0, ""),
        "收": (-5, "收日收敛"),
        "执": (-10, "执日观望"),
        "危": (-15, "危日谨慎"),
        "破": (-30, "破日大凶"),
        "闭": (-30, "闭日大凶"),
    }
    w, reason = jianchu_weights.get(jianchu, (0, ""))
    score += w
    if reason:
        reasons.append(reason)

    # 桃花和喜神重合
    taohua_base = day_taohua_dir.split("偏")[0]  # "正南" or "东北偏东" → "正南" / "东北"
    xishen_base = xishen_dir.split("偏")[0]
    if taohua_base == xishen_dir or xishen_base == xishen_dir or taohua_base == xishen_base:
        score += 20
        reasons.append("桃花与喜神同方位")

    # 天喜日
    if is_tianxi_day:
        score += 15
        reasons.append("今日为天喜日（日支与月建六合）")

    # 宜忌感情项
    love_good = {"嫁娶", "纳采", "订婚", "出行", "会友", "安床"}
    love_bad = {"嫁娶", "词讼"}

    yi_love = [y for y in yiji["宜"] if y in love_good]
    ji_love = [j for j in yiji["忌"] if j in love_bad]

    if any(y in love_good for y in yiji["宜"]):
        score += min(len(yi_love) * 3, 10)
        if "嫁娶" in yiji["宜"] or "纳采" in yiji["宜"] or "订婚" in yiji["宜"]:
            reasons.append("宜嫁娶纳采")

    if "嫁娶" in yiji["忌"]:
        score -= 15
        reasons.append("忌嫁娶")
    if "词讼" in yiji["忌"]:
        score -= 10
        reasons.append("忌词讼口舌")

    score = max(0, min(100, score))

    # 评级
    if score >= 85:
        level = "🔥 爆棚"
    elif score >= 70:
        level = "🌤️ 不错"
    elif score >= 55:
        level = "😐 平常"
    elif score >= 40:
        level = "🌧️ 偏低"
    elif score >= 25:
        level = "⚠️ 低迷"
    else:
        level = "❄️ 冰点"

    return {
        "分数": score,
        "评级": level,
        "加分项": reasons,
        "一句话": f"桃花指数 {score}/100，{level}" + (f"——{reasons[0]}" if reasons else ""),
    }


# ============================================================
# 今日行动指南（通俗落地版）
# 把命理数据翻译成用户一看就知道怎么做的建议
# ============================================================

# 五行 → 颜色穿戴建议
WUXING_WEAR = {
    "金": {"颜色": ["白色", "银色", "金色"], "材质": "金属饰品、白水晶、银饰",
           "造型": "圆形、简约线条", "tip": "戴条银色项链或白水晶手串"},
    "木": {"颜色": ["绿色", "青色", "浅蓝"], "材质": "木质饰品、绿松石",
           "造型": "条纹、植物纹样", "tip": "戴个木质手串或绿色发饰"},
    "水": {"颜色": ["黑色", "深蓝", "藏青"], "材质": "黑曜石、珍珠、流水纹饰品",
           "造型": "波浪纹、流线型", "tip": "戴黑曜石或珍珠耳钉"},
    "火": {"颜色": ["红色", "紫色", "橙色"], "材质": "红玛瑙、紫水晶、红色饰品",
           "造型": "三角形、尖角纹样", "tip": "涂个红唇或戴红绳手链"},
    "土": {"颜色": ["黄色", "棕色", "卡其色"], "材质": "黄水晶、陶瓷、琥珀",
           "造型": "方形、格子纹", "tip": "搭个棕色包包或黄水晶吊坠"},
}

# 方位 → 约会场所建议
DIRECTION_VENUES = {
    "正北": "城市北边的咖啡馆、水边餐厅、海洋馆",
    "正南": "城南的livehouse、火锅店、运动场馆",
    "正东": "城东的书店、公园、植物园",
    "正西": "城西的商场、金饰店、美术馆",
    "东北偏北": "东北方向的书吧、陶艺馆",
    "东北偏东": "东北方向的茶馆、文玩市场",
    "东南偏东": "东南方向的手作店、陶吧",
    "东南偏南": "东南方向的灯光展、夜市",
    "西南偏南": "西南方向的甜品店、花市",
    "西南偏西": "西南方向的珠宝店、茶餐厅",
    "西北偏西": "西北方向的电影院、火锅店",
    "西北偏北": "西北方向的水族馆、清吧",
    "东北": "东北方向的书店、茶馆",
    "东南": "东南方向的花园、夜市",
    "西南": "西南方向的甜品店、花店",
    "西北": "西北方向的艺术馆、咖啡厅",
}

def _build_practical_guide(taohua_wuxing, day_taohua_dir, yiji, fangwei, zodiac=None,
                          jianchu=None, score=50):
    """
    生成通俗的今日行动指南。
    三个维度：
      1. 约会方位——去哪约会（根据指数自动调整推荐强度）
      2. 活动建议——做什么好/避免什么
      3. 穿戴建议——穿什么颜色/戴什么（双层：日支+本命）
    """
    guide = {"约会方位": {}, "活动建议": {}, "穿戴建议": {}}

    # ── 本命五行 ──
    ZODIAC_WUXING = {
        "鼠": "水", "牛": "土", "虎": "木", "兔": "木",
        "龙": "土", "蛇": "火", "马": "火", "羊": "土",
        "猴": "金", "鸡": "金", "狗": "土", "猪": "水",
    }
    benming_wx = ZODIAC_WUXING.get(zodiac, "火") if zodiac else None

    # ── 1. 约会方位（根据指数自适应） ──
    xishen_dir = fangwei["喜神"]["方位"]
    taohua_dir = day_taohua_dir

    # 根据指数决定推荐强度
    if score >= 70:
        # 高分：积极推荐具体场所
        date_msg = f"今日桃花在{taohua_dir}，指数{score}分，大胆约！"
        venue_taohua = DIRECTION_VENUES.get(taohua_dir, "该方向的城市公共空间")
        venue_xishen = DIRECTION_VENUES.get(xishen_dir, "该方向的城市公共空间")
        oneliner = f"约会往{taohua_dir}走，社交往{xishen_dir}走。"
    elif score >= 40:
        # 中等：温和推荐
        date_msg = f"今日桃花在{taohua_dir}，指数{score}分，适合轻松约会"
        venue_taohua = DIRECTION_VENUES.get(taohua_dir, "该方向的城市公共空间")
        venue_xishen = DIRECTION_VENUES.get(xishen_dir, "该方向的城市公共空间")
        oneliner = f"约会往{taohua_dir}走，社交往{xishen_dir}走。"
    else:
        # 低分：线上为主，不建议线下
        date_msg = f"今日桃花指数仅{score}分，不建议安排重要约会"
        venue_taohua = "今天不适合线下约会，线上聊聊就好"
        venue_xishen = "线上社交为主，改天再约见面"
        oneliner = f"今天{taohua_dir}方位桃花能量偏弱，线上互动更稳妥，改天再约。"

    guide["约会方位"] = {
        "桃花方位": {
            "方位": taohua_dir,
            "场所建议": venue_taohua,
            "说明": date_msg,
        },
        "喜神方位": {
            "方位": xishen_dir,
            "场所建议": venue_xishen,
            "说明": f"喜神在{xishen_dir}，" + ("社交聚会选此方向气氛最好。" if score >= 40 else "适合线上社交互动。"),
        },
        "一句话": oneliner,
    }

    # ── 2. 活动建议（日常交往指导，基于建除十二神） ──
    jianchu = yiji["建除"]
    vibe = _get_day_vibe(jianchu)
    guide["活动建议"] = vibe

    # ── 3. 穿戴建议（双层） ──
    wear = WUXING_WEAR.get(taohua_wuxing, WUXING_WEAR["火"])
    ll = wear["颜色"]

    wear_info = {
        "桃花五行": taohua_wuxing,
        "桃花颜色": ll,
        "桃花材质": wear["材质"],
        "桃花点睛": wear["tip"],
    }

    if benming_wx:
        wear_info["本命五行"] = benming_wx
        WUXING_RELATION = {
            ("木", "火"): ("木生火", f"穿绿色（你的木色）为主，搭一点{ll[0]}（桃花色），把你的能量导向桃花位"),
            ("木", "土"): ("木克土", f"穿绿色+{ll[0]}，{wear['tip']}，主动平衡克制"),
            ("木", "金"): ("金克木", f"穿{ll[0]}+绿色，{wear['tip']}，金银饰和木质手串叠戴化解克制"),
            ("木", "水"): ("水生木", f"桃花位在滋养你，穿{ll[0]}即可，不必刻意——今天气场对你好"),
            ("木", "木"): ("双木成林", f"穿绿色+{ll[0]}层叠，{wear['tip']}，天生契合"),
            ("火", "土"): ("火生土", f"穿红色（你的火色）为主，搭一点{ll[0]}（桃花色），把你的能量导向桃花位"),
            ("火", "金"): ("火克金", f"穿红色+{ll[0]}，{wear['tip']}，主动平衡克制"),
            ("火", "水"): ("水克火", f"穿{ll[0]}+红色，{wear['tip']}，桃花位在克制你，叠戴化解"),
            ("火", "木"): ("木生火", f"桃花位在滋养你，穿{ll[0]}即可——今天气场对你好"),
            ("火", "火"): ("双火同辉", f"穿红色+{ll[0]}，{wear['tip']}，能量共振"),
            ("土", "金"): ("土生金", f"穿黄色（你的土色）为主，搭一点{ll[0]}（桃花色），把你的能量导向桃花位"),
            ("土", "水"): ("土克水", f"穿黄色+{ll[0]}，{wear['tip']}，主动平衡克制"),
            ("土", "木"): ("木克土", f"穿{ll[0]}+黄色，{wear['tip']}，桃花位在克制你，叠戴化解"),
            ("土", "火"): ("火生土", f"桃花位在滋养你，穿{ll[0]}即可——今天气场对你好"),
            ("土", "土"): ("双土厚重", f"穿黄色+{ll[0]}层叠，{wear['tip']}，稳健搭配"),
            ("金", "水"): ("金生水", f"穿白色（你的金色）为主，搭一点{ll[0]}（桃花色），把你的能量导向桃花位"),
            ("金", "木"): ("金克木", f"穿白色+{ll[0]}，{wear['tip']}，主动平衡克制"),
            ("金", "火"): ("火克金", f"穿{ll[0]}+白色，{wear['tip']}，桃花位在克制你，叠戴化解"),
            ("金", "土"): ("土生金", f"桃花位在滋养你，穿{ll[0]}即可——今天气场对你好"),
            ("金", "金"): ("双金铿锵", f"穿白色+{ll[0]}，{wear['tip']}，能量共振"),
            ("水", "木"): ("水生木", f"穿黑色（你的水色）为主，搭一点{ll[0]}（桃花色），把你的能量导向桃花位"),
            ("水", "火"): ("水克火", f"穿黑色+{ll[0]}，{wear['tip']}，主动平衡克制"),
            ("水", "土"): ("土克水", f"穿{ll[0]}+黑色，{wear['tip']}，桃花位在克制你，叠戴化解"),
            ("水", "金"): ("金生水", f"桃花位在滋养你，穿{ll[0]}即可——今天气场对你好"),
            ("水", "水"): ("双水共流", f"穿黑色+{ll[0]}层叠，{wear['tip']}，能量共振"),
        }
        rel_key = (benming_wx, taohua_wuxing)
        relation, advice = WUXING_RELATION.get(rel_key, ("", f"穿{ll[0]}或{ll[1]}，{wear['tip']}"))
        wear_info["五行关系"] = relation
        wear_info["一句话"] = advice
    else:
        wear_info["一句话"] = f"今天穿{ll[0]}或{ll[1]}，{wear['tip']}，桃花运加成。"

    guide["穿戴建议"] = wear_info
    return guide


def _get_day_vibe(jianchu):
    """
    基于建除十二神，生成今日感情 vibe + 日常交往建议。
    面向 Crush/恋爱初期场景，给的是"今天要不要发消息、适不适合约会"这类建议。
    """
    VIBE_MAP = {
        "成": {
            "vibe": "🌤️ 好日子",
            "summary": "成日万事圆满，是感情上最好的日子之一。",
            "dos": [
                "主动发消息聊天，TA回复的概率比平时高",
                "约TA出来见面，今天的气场适合深度交流",
                "表达好感，成日的能量会让真诚被看见",
            ],
            "donts": ["别宅在家，好日子不出门就浪费了"],
            "activities": ["看电影", "吃顿好的", "看展览/逛博物馆", "散步聊天"],
            "一句话": "成日大吉——主动一点，真诚一点。适合约TA看电影、吃饭、散步，做什么都顺。",
        },
        "开": {
            "vibe": "✨ 新开始",
            "summary": "开日是开创之日，适合开启一段新的互动。",
            "dos": [
                "第一次约TA出来，开日的气场适合破冰",
                "开启新话题，聊点平时没聊过的",
                "主动加微信或发第一条消息",
            ],
            "donts": ["别犹豫太久，开日的能量过了就没了", "不要纠结过去的误会"],
            "activities": ["喝咖啡/下午茶", "逛市集/创意园区", "打羽毛球/台球", "一起去书店"],
            "一句话": "开日——适合迈出第一步。约TA喝咖啡、逛市集、打羽毛球，轻松破冰。",
        },
        "满": {
            "vibe": "🌕 丰收日",
            "summary": "满日代表圆满和收获，适合巩固已有关系。",
            "dos": [
                "送个小礼物或请TA吃饭",
                "约TA去热闹的地方，人多氛围好",
                "朋友聚会时带上TA，融入彼此社交圈",
            ],
            "donts": ["不要急着推进太快", "不要因为小事计较"],
            "activities": ["吃火锅/烧烤", "看livehouse/演出", "参加朋友聚会", "逛夜市/美食街"],
            "一句话": "满日——适合热闹的约会。吃火锅、看演出、逛夜市，大家一起更开心。",
        },
        "定": {
            "vibe": "⚓ 稳定日",
            "summary": "定日代表安定稳固，适合确定心意。",
            "dos": [
                "好好聊一次天，把彼此想法说清楚",
                "给对方一个明确的信号，不要暧昧",
                "今天说的话容易被记住，适合认真交流",
            ],
            "donts": ["不要忽冷忽热", "不要同时撩好几个人"],
            "activities": ["安静咖啡馆长谈", "一起做饭", "公园长椅聊天", "江边/湖边散步"],
            "一句话": "定日——适合安静的深度约会。咖啡馆长谈、一起做饭、江边散步，把话说清楚。",
        },
        "平": {
            "vibe": "😐 平常心",
            "summary": "平日诸事平常，顺其自然就好。",
            "dos": [
                "按平时的节奏聊天就好",
                "做你自己，真诚比套路更重要",
            ],
            "donts": ["不要刻意制造惊喜", "不要因为回复慢了就焦虑"],
            "activities": ["随便吃个饭", "一起散步", "看剧/刷综艺", "线上聊天"],
            "一句话": "平日——平常心。随便吃个饭、散个步、线上聊聊都行，不用刻意安排。",
        },
        "执": {
            "vibe": "🔒 观望日",
            "summary": "执日宜守不宜攻，适合观察等待。",
            "dos": [
                "观察TA的动态，收集信息比行动重要",
                "花时间提升自己——健身、看书、学技能",
            ],
            "donts": ["不要冲动表白", "不要频繁发消息追问", "不要做重大感情决定"],
            "activities": ["自己去健身/跑步", "在家看书/看电影", "整理房间/换发型", "线上随便聊聊即可"],
            "一句话": "执日——观望比行动明智。今天适合提升自己，健身、看书、换个发型，让TA注意到你的变化。",
        },
        "破": {
            "vibe": "⚠️ 避开日",
            "summary": "破日大凶，感情上宜静不宜动。",
            "dos": [
                "保持现有节奏，不主动也不刻意冷淡",
                "如果TA心情不好，给TA空间",
            ],
            "donts": [
                "千万不要表白或提分手",
                "不要翻旧账或挑起争论",
                "不要约重要约会",
                "不要发情绪化的长消息",
            ],
            "activities": ["不适合约会", "自己待着最安全", "打游戏/刷剧转移注意力"],
            "一句话": "破日——不适合任何感情大动作。自己待着，打打游戏刷刷剧，过了今天再说。",
        },
        "危": {
            "vibe": "🌧️ 谨慎日",
            "summary": "危日小心行事，稳妥为上。",
            "dos": [
                "保持日常问候即可",
                "如果一定要见面，选熟悉的地方",
            ],
            "donts": ["不要试探TA的态度", "不要发暗示性内容", "不要酒后发消息或打电话"],
            "activities": ["线上聊天最安全", "约在常去的老地方", "一起打游戏（线上）", "看同一部电影然后聊感受"],
            "一句话": "危日——谨慎一点。线上聊聊、一起打打游戏就好，别急着见面。",
        },
        "收": {
            "vibe": "📝 回顾日",
            "summary": "收日宜收纳整理，适合回顾小结。",
            "dos": [
                "回顾最近的互动，想想哪里可以改进",
                "整理聊天记录或你们的照片",
                "发个简单问候但不适合深聊",
            ],
            "donts": ["不要急着推进关系", "不要翻旧账"],
            "activities": ["整理照片做个小合集发给TA", "约TA一起整理东西/大扫除", "轻松吃个便饭", "一起逛超市"],
            "一句话": "收日——适合整理回顾。翻翻聊天记录找感觉，约TA逛超市、吃便饭这种日常小事就很好。",
        },
        "闭": {
            "vibe": "🔇 低调日",
            "summary": "闭日诸事不宜，适合低调内省。",
            "dos": [
                "今天适合独处充电",
                "如果TA主动找你，正常回应就好",
            ],
            "donts": ["不要主动发起社交或约会", "不要做任何重要的感情决定"],
            "activities": ["一个人待着最好", "泡澡/做面膜/护肤", "写日记/整理心情", "早点睡"],
            "一句话": "闭日——适合独处充电。泡个澡做做面膜早点睡，明天状态更好。",
        },
        "除": {
            "vibe": "🧹 除旧日",
            "summary": "除日宜除旧布新，适合化解误会。",
            "dos": [
                "如果有误会或冷战，今天是和解的好时机",
                "坦诚沟通，把心里的疙瘩说出来",
                "约TA去新鲜的地方，换换环境",
            ],
            "donts": ["不要揪着旧事不放", "不要在新关系里重复旧错误"],
            "activities": ["约TA去新开的餐厅", "一起去爬山/徒步", "看一场电影然后聊聊感受", "泡温泉/汗蒸"],
            "一句话": "除日——适合化解误会、翻篇重来。约TA去新餐厅、爬山、泡温泉，换个环境把话说开。",
        },
        "建": {
            "vibe": "🌱 尝试日",
            "summary": "建日万物开始，适合新的尝试。",
            "dos": [
                "尝试新的聊天方式或话题",
                "换个形象或风格",
                "迈出一小步，不必太大",
            ],
            "donts": ["不要一上来就要承诺", "不要因为小挫折就放弃"],
            "activities": ["约TA去新开的店", "一起体验没做过的事（陶艺/烘焙/密室）", "换个穿衣风格约TA", "一起运动（攀岩/骑行/打球）"],
            "一句话": "建日——适合新尝试。约TA去新店、做陶艺、攀岩骑行，新鲜感是最好的吸引力。",
        },
    }

    v = VIBE_MAP.get(jianchu, VIBE_MAP["平"])
    return {
        "今日气场": v["vibe"],
        "建除": jianchu,
        "解读": v["summary"],
        "建议活动": v["activities"],
        "宜做": v["dos"],
        "避开": v["donts"],
        "一句话": v["一句话"],
    }


# ============================================================
# AI 解释生成
# ============================================================

def generate_ai_explanation(report: dict) -> str:
    """生成自然语言解释，可直接展示用户或作为LLM prompt上下文。"""
    if "error" in report:
        return f"查询失败：{report['error']}"

    zodiac = report["元数据"]["生肖"]
    sign = report["元数据"]["星座"]
    ganzhi = report["元数据"]["当前干支"]
    jq = report["节气"]
    taohua = report["本命桃花"]
    hl = report["本命红鸾天喜"]
    y_taohua = report["流年桃花"]
    m_taohua = report["流月桃花"]
    d_taohua = report["流日桃花"]
    y_hl = report["流年红鸾天喜"]
    m_hl = report["流月红鸾天喜"]
    d_hl = report["流日红鸾天喜"]
    cross = report["属相星座交叉"]
    dual = report["星座双维度"]
    cn = cross.get("中国星次", {})
    wz = cross.get("西方星座", {})
    fw = report["今日方位"]
    yj = report["今日宜忌"]

    L = []
    L.append(f"—— {zodiac}肖 {sign} 桃花感情分析 ——")
    L.append(f"查询时间：{jq['农历月']} | {jq['当前节气']}（下一节气：{jq['下一节气']}）")
    L.append(f"流年：{ganzhi['流年']} | 流月：{ganzhi['流月']} | 流日：{ganzhi['流日']}")
    L.append("")

    # ── 本命桃花（终身不变） ──
    L.append("══ 桃花方位 · 动态计算 ══")
    L.append("")
    L.append("─ 本命桃花（终身不变，基于出生年生肖）─")
    if "error" not in taohua:
        L.append(f"咸池桃花位：{taohua['direction']}")
        L.append(f"原理：{taohua['principle']}")
        L.append(f"三合生肖：{'、'.join(taohua['sanhe_ju'])}")
        L.append(f"桃花地支：{taohua['taohua_zhi']}（{taohua['taohua_zodiac']}）")
        L.append(f"属性：{taohua['taohua_quality']}")
    L.append(f"红鸾：{hl['hongluan']['direction']} — {hl['hongluan']['meaning']}")
    L.append(f"天喜：{hl['tianxi']['direction']} — {hl['tianxi']['meaning']}")
    L.append("")

    # ── 流年/流月/流日 ──
    L.append(f"─ 流年桃花 ─")
    L.append(f"咸池：{y_taohua['direction']} | 红鸾：{y_hl['hongluan']['direction']} | 天喜：{y_hl['tianxi']['direction']}")
    L.append(f"─ 流月桃花 ─")
    L.append(f"咸池：{m_taohua['direction']} | 红鸾：{m_hl['hongluan']['direction']} | 天喜：{m_hl['tianxi']['direction']}")
    L.append(f"─ 流日桃花 ─")
    L.append(f"咸池：{d_taohua['direction']} | 红鸾：{d_hl['hongluan']['direction']} | 天喜：{d_hl['tianxi']['direction']}")
    L.append("")

    # ── 属相×星座交叉 ──
    L.append("══ 属相 × 星座交叉 ══")
    L.append(f"【地支关系】{cross['地支关系']} — {cross['关系解读']}")
    L.append("")

    # ── 中国传统维度（十二星次） ──
    L.append("══ 星座双维度解析 ══")
    L.append("")
    L.append("── 中国传统维度：十二星次 ──")
    L.append(f"出处：{cn.get('出处', '')}")
    L.append(f"星次：{cn.get('名称', '')}（{cn.get('地支', '')}，{cn.get('宫位', '')}）")
    L.append(f"五行：{cn.get('五行', '')} | 阴阳：{cn.get('阴阳', '')}")
    L.append(f"节气范围：{cn.get('节气范围', '')} | 近似公历：{cn.get('近似公历', '')}")
    L.append(f"历法：{cn.get('历法', '')}")
    L.append(f"性格：{cn.get('性格', '')}")
    L.append("")

    # ── 西方传统维度（十二星座） ──
    L.append("── 西方传统维度：十二星座 ──")
    L.append(f"出处：{wz.get('出处', '')}")
    L.append(f"主宰星：{wz.get('主宰星', '')} | 元素：{wz.get('元素', '')} | 形态：{wz.get('形态', '')}")
    L.append(f"公历日期：{wz.get('公历日期', '')}（热带黄道固定范围）")
    L.append(f"桃花风格：{wz.get('桃花风格', '')}")
    L.append(f"古典考据：{wz.get('古典出处', '')}")
    L.append(f"最佳配对：{'、'.join(wz.get('最佳配对', []))}（{wz.get('配对原理', '')}）")
    L.append("")

    # ── 今日行动指南 ──
    L.append("══ 今日行动指南 ══")
    L.append(f"公历：{fw['公历日期']} | 农历：{fw['农历']} | 日柱：{fw['日柱']}")
    L.append(f"建除：{yj['建除']} | 星宿：{fw['二十八宿']}")
    L.append(f"彭祖百忌：{fw['彭祖百忌']}")
    L.append(f"喜神在{fw['喜神']['方位']} — 约会社交首选")
    L.append(f"阳贵{fw['阳贵']['方位']}（{fw['阳贵']['卦']}）| 阴贵{fw['阴贵']['方位']}（{fw['阴贵']['卦']}）")
    L.append(f"冲煞：{fw['生肖日冲']} | 煞{fw['煞方']}")
    L.append(f"今日宜({len(yj['宜'])}项)：{'、'.join(yj['宜'][:10])}...")
    L.append(f"今日忌({len(yj['忌'])}项)：{'、'.join(yj['忌'][:10])}...")
    L.append(f"吉神：{'、'.join(yj['吉神'])}")
    L.append(f"凶煞：{'、'.join(yj['凶煞'])}")

    return "\n".join(L)


# ============================================================
# CLI 测试
# ============================================================

if __name__ == "__main__":
    import sys
    zodiac = sys.argv[1] if len(sys.argv) > 1 else "鼠"
    sign = sys.argv[2] if len(sys.argv) > 2 else "双子座"

    report = query_love_report(zodiac, sign)
    explanation = generate_ai_explanation(report)
    print(explanation)
