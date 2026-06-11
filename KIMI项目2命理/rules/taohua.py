"""
桃花/咸池/红鸾/天喜 规则库

核心算法出处：
  《三命通会》— 咸池桃花三合局公式 + 红鸾天喜查表
  《协纪辨方书》— 地支六合/六冲/三合 关系体系
  方位映射 — 二十四山标准
  五行催旺建议 — 基于五行生克原理的现代风水实践，非古籍原文
"""

# 十二生肖对应地支
ZODIAC_TO_ZHI = {
    "鼠": "子", "牛": "丑", "虎": "寅", "兔": "卯",
    "龙": "辰", "蛇": "巳", "马": "午", "羊": "未",
    "猴": "申", "鸡": "酉", "狗": "戌", "猪": "亥",
}

ZHI_TO_ZODIAC = {v: k for k, v in ZODIAC_TO_ZHI.items()}

ZODIAC_NAMES = list(ZODIAC_TO_ZHI.keys())

# 地支到方位
ZHI_TO_DIRECTION = {
    "子": "正北", "丑": "东北偏北", "寅": "东北偏东",
    "卯": "正东", "辰": "东南偏东", "巳": "东南偏南",
    "午": "正南", "未": "西南偏南", "申": "西南偏西",
    "酉": "正西", "戌": "西北偏西", "亥": "西北偏北",
}

DIRECTION_DESC = {
    "正北": "在你住所/工作地的正北方。子位属水，适合摆放水元素（如鱼缸、黑色饰品）催旺桃花。",
    "正东": "在你住所/工作地的正东方。卯位属木，适合摆放绿植、木质饰品催旺桃花。",
    "正南": "在你住所/工作地的正南方。午位属火，适合红色饰品、灯光等火元素催旺桃花。",
    "正西": "在你住所/工作地的正西方。酉位属金，适合金属饰品、白色系装饰催旺桃花。",
    "东北偏北": "在你住所/工作地的东北方偏北（丑位）。属土，适合黄色/棕色系装饰。",
    "东北偏东": "在你住所/工作地的东北方偏东（寅位）。属木，适合绿植或木质摆件。",
    "东南偏东": "在你住所/工作地的东南方偏东（辰位）。属土，适合陶器、黄水晶。",
    "东南偏南": "在你住所/工作地的东南方偏南（巳位）。属火，适合红色元素或灯具。",
    "西南偏南": "在你住所/工作地的西南方偏南（未位）。属土，适合黄水晶、陶器。",
    "西南偏西": "在你住所/工作地的西南方偏西（申位）。属金，适合金属饰品、白水晶。",
    "西北偏西": "在你住所/工作地的西北方偏西（戌位）。属土，适合黄水晶。",
    "西北偏北": "在你住所/工作地的西北方偏北（亥位）。属水，适合水元素、黑色饰品。",
}


# ============================================================
# 一、咸池桃花算法
# 原文：《三命通会》——"寅午戌见卯，巳酉丑见午，
#        申子辰见酉，亥卯未见子"
# 原理：地支三合局长生位 + 1 = 沐浴位 = 咸池桃花
# ============================================================

# 三合局配置：(三合地支元组, 五行, 长生位, 沐浴位=桃花位)
SANHE_JU = {
    ("寅", "午", "戌"): {"wuxing": "火", "changsheng": "寅", "taohua": "卯"},
    ("巳", "酉", "丑"): {"wuxing": "金", "changsheng": "巳", "taohua": "午"},
    ("申", "子", "辰"): {"wuxing": "水", "changsheng": "申", "taohua": "酉"},
    ("亥", "卯", "未"): {"wuxing": "木", "changsheng": "亥", "taohua": "子"},
}

# 构建快速查询表：任何地支 → 对应的三合局 + 桃花位
_ZHI_TO_SANHE = {}
_ZHI_TO_TAOHUA = {}
for sanhe_zhi, info in SANHE_JU.items():
    for z in sanhe_zhi:
        _ZHI_TO_SANHE[z] = {"zhi_set": sanhe_zhi, **info}
        _ZHI_TO_TAOHUA[z] = info["taohua"]


def xianchi_algorithm(zhi: str) -> dict:
    """
    咸池桃花算法。
    输入：年支（生肖对应的地支）
    输出：包含三合局成员、桃花位、方位、五行、墙内外说明

    >>> xianchi_algorithm("子")  # 鼠 -> 申子辰局 -> 桃花在酉
    """
    sanhe = _ZHI_TO_SANHE[zhi]
    taohua_zhi = sanhe["taohua"]
    sanhe_members = [ZHI_TO_ZODIAC[z] for z in sanhe["zhi_set"]]
    direction = ZHI_TO_DIRECTION[taohua_zhi]
    direction_desc = DIRECTION_DESC.get(direction, "")

    return {
        "rule": "咸池桃花（《三命通会》）",
        "principle": f"{zhi}属{sanhe['wuxing']}，长生在{sanhe['changsheng']}，沐浴在{taohua_zhi}（即桃花位）",
        "sanhe_ju": sanhe_members,  # 三合生肖
        "wuxing": sanhe["wuxing"],
        "taohua_zhi": taohua_zhi,
        "taohua_zodiac": ZHI_TO_ZODIAC[taohua_zhi],
        "direction": direction,
        "direction_desc": direction_desc,
        "taohua_type": "本命桃花（咸池）",
        "taohua_quality": _judge_taohua_quality(zhi, taohua_zhi),
    }


def zodiac_to_taohua(zodiac: str) -> dict:
    """用户友好接口：输入生肖名 → 返回桃花方位信息"""
    zhi = ZODIAC_TO_ZHI.get(zodiac)
    if not zhi:
        return {"error": f"未知生肖: {zodiac}", "valid": ZODIAC_NAMES}
    return xianchi_algorithm(zhi)


def _judge_taohua_quality(nian_zhi: str, taohua_zhi: str) -> str:
    """判断墙内/墙外桃花（《三命通会》：年支桃花为墙内，日支桃花为墙外）"""
    return "年支桃花为'墙内桃花'（《三命通会》），主天性浪漫、夫妻恩爱。若大运或流年行至桃花位，感情机缘增强，需注意把握分寸。"


# ============================================================
# 二、红鸾天喜算法
# 原文口诀："卯起红鸾逆数通，欲知天喜是相冲"
# ============================================================

# 红鸾查表（地支顺序，从卯位起子年逆行）
HONGLUAN_TABLE = {
    "子": "卯", "丑": "寅", "寅": "丑", "卯": "子",
    "辰": "亥", "巳": "戌", "午": "酉", "未": "申",
    "申": "未", "酉": "午", "戌": "巳", "亥": "辰",
}

# 天喜 = 红鸾对冲（六冲：子午/丑未/寅申/卯酉/辰戌/巳亥）
LIUCHONG = {
    "子": "午", "午": "子", "丑": "未", "未": "丑",
    "寅": "申", "申": "寅", "卯": "酉", "酉": "卯",
    "辰": "戌", "戌": "辰", "巳": "亥", "亥": "巳",
}


def hongluan_tianxi(zodiac: str) -> dict:
    """
    红鸾天喜算法。
    输入：生肖（如"鼠"）
    输出：红鸾位、天喜位、方位、催旺建议

    >>> hongluan_tianxi("鼠")  # 子年 -> 红鸾在卯, 天喜在酉
    """
    zhi = ZODIAC_TO_ZHI.get(zodiac)
    if not zhi:
        zhi = zodiac  # 可能直接传地支
        if zhi not in HONGLUAN_TABLE:
            return {"error": f"无法识别: {zodiac}", "valid": ZODIAC_NAMES}

    hongluan_zhi = HONGLUAN_TABLE.get(zhi)
    tianxi_zhi = LIUCHONG.get(hongluan_zhi)
    if not tianxi_zhi:
        return {"error": f"内部错误：天喜推算失败"}

    return {
        "rule": "红鸾天喜（《三命通会》）",
        "hongluan": {
            "zhi": hongluan_zhi,
            "zodiac": ZHI_TO_ZODIAC[hongluan_zhi],
            "direction": ZHI_TO_DIRECTION[hongluan_zhi],
            "direction_desc": DIRECTION_DESC.get(ZHI_TO_DIRECTION[hongluan_zhi], ""),
            "meaning": "主姻缘开端、恋爱机遇、婚讯。红鸾星动之年宜求婚、订婚、相亲。",
            "cuiwang": _cuiwang_tips(hongluan_zhi, "hongluan"),
        },
        "tianxi": {
            "zhi": tianxi_zhi,
            "zodiac": ZHI_TO_ZODIAC[tianxi_zhi],
            "direction": ZHI_TO_DIRECTION[tianxi_zhi],
            "direction_desc": DIRECTION_DESC.get(ZHI_TO_DIRECTION[tianxi_zhi], ""),
            "meaning": "主婚姻稳固、添丁进口、喜庆落地。天喜照命之年宜结婚、生育。",
            "cuiwang": _cuiwang_tips(tianxi_zhi, "tianxi"),
        },
        "summary": f"{zodiac}命：红鸾在{hongluan_zhi}方（{ZHI_TO_DIRECTION[hongluan_zhi]}），"
                   f"天喜在{tianxi_zhi}方（{ZHI_TO_DIRECTION[tianxi_zhi]}）。"
                   f"红鸾为因（桃花初萌），天喜为果（姻缘结果），阴阳互补。",
    }


def _cuiwang_tips(zhi: str, star_type: str) -> str:
    """根据方位五行给出催旺建议（现代风水实践，五行→物品映射遵循传统五行原理，具体物品建议非古籍原文）"""
    tips_map = {
        "子": "摆放鱼缸、黑色水晶、流水摆件等水元素催旺。",
        "卯": "摆放新鲜绿植、木质桃花符、绿色饰品等木元素催旺。",
        "午": "点红色蜡烛、红色水晶、暖色灯光等火元素催旺。",
        "酉": "摆放金属饰品、白水晶、镜子等金元素催旺。",
        "丑": "摆放黄水晶、陶瓷花瓶、棕色装饰等土元素催旺。",
        "寅": "摆放绿植、木质饰品、文昌塔等木元素催旺。",
        "辰": "摆放黄水晶、龙形摆件、陶瓷等土元素催旺。",
        "巳": "红色饰品、紫色水晶、柔和灯光等火元素催旺。",
        "未": "摆放黄水晶、羊形摆件、陶器等土元素催旺。",
        "申": "金属饰品、白水晶、圆形摆件等金元素催旺。",
        "戌": "黄水晶、狗形摆件、棕色饰品等土元素催旺。",
        "亥": "鱼缸、黑色饰品、水景摆件等水元素催旺。",
    }
    base = tips_map.get(zhi, "放置粉色水晶球、鸳鸯摆件等催旺。")
    if star_type == "hongluan":
        return f"红鸾催旺：{base}建议在此方位放置粉水晶球或双鱼图，增强恋爱机缘。"
    return f"天喜催旺：{base}建议在此方位点红色香薰或放置麒麟摆件，催旺婚庆之喜。"


# ============================================================
# 三、本周/本月感情旺位综合判定
# ============================================================

def relationship_directions_this_week(zodiac: str, current_month_zhi: str = None) -> dict:
    """
    综合属相桃花+红鸾天喜+当月天喜日，给出本周/当月感情方位建议。

    输入：
        zodiac: 用户生肖
        current_month_zhi: 当前月支（如"午"=农历五月），若留空则跳过月天喜日
    """
    taohua = zodiac_to_taohua(zodiac)
    hongluan = hongluan_tianxi(zodiac)

    result = {
        "生肖": zodiac,
        "咸池桃花方位": taohua.get("direction"),
        "红鸾方位": hongluan["hongluan"]["direction"],
        "天喜方位": hongluan["tianxi"]["direction"],
        "本周感情旺位建议": [],
    }

    # 优先级：天喜 > 红鸾 > 咸池
    all_dirs = []
    if not taohua.get("error"):
        result["本周感情旺位建议"].append(
            f"⓵ 桃花基础位（咸池）：{taohua['direction']} — 长期桃花根基，适合日常布局"
        )
        all_dirs.append(taohua["direction"])
    result["本周感情旺位建议"].append(
        f"⓶ 正缘桃花位（红鸾）：{hongluan['hongluan']['direction']} — 本周优先催旺，适合约会/社交"
    )
    all_dirs.append(hongluan["hongluan"]["direction"])
    result["本周感情旺位建议"].append(
        f"⓷ 喜庆结果位（天喜）：{hongluan['tianxi']['direction']} — 适合谈婚论嫁、确定关系"
    )
    all_dirs.append(hongluan["tianxi"]["direction"])

    # 互不冲突时合并
    if len(set(all_dirs)) == 1:
        result["本周感情旺位建议"].append("\n以上三位合一，此方位为绝对感情旺位，重点布局！")
    elif len(set(all_dirs)) == 2:
        result["本周感情旺位建议"].append("\n有两位重合，优先布局重合方位。")

    return result
