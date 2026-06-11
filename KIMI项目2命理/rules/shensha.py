"""
喜神/财神/福神/天乙贵人 方位规则

口诀出处：《协纪辨方书》
  喜神 — 五虎遁推丙法，"甲己在艮乙庚乾..."
  财神 — "甲艮乙坤丙丁兑..."
  福神 — "甲己正北是福神..."
  天乙贵人 — "甲戊庚牛羊，乙己鼠猴乡..."
底层日历计算 — lunar-python（寿星天文历，MIT协议）
"""

from .taohua import ZHI_TO_DIRECTION

# 八卦到方位
BAGUA_TO_DIR = {
    "艮": "东北方", "乾": "西北方", "坤": "西南方",
    "离": "正南方", "巽": "东南方", "坎": "正北方",
    "震": "正东方", "兑": "正西方",
}

# 日干表（用于查找当天的天干）
TIANGAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]


def ganzhi_of_day(gregorian_date=None):
    """
    计算指定公历日期的日干支。
    采用 lunar-python 库（MIT协议）的寿星天文历算法，精度可靠。
    """
    from lunar_python import Solar
    import datetime
    if gregorian_date is None:
        gregorian_date = datetime.datetime.now()
    elif isinstance(gregorian_date, datetime.date) and not isinstance(gregorian_date, datetime.datetime):
        gregorian_date = datetime.datetime(gregorian_date.year, gregorian_date.month,
                                           gregorian_date.day, 12, 0, 0)
    l = Solar.fromDate(gregorian_date).getLunar()
    return l.getDayInGanZhi()[0], l.getDayInGanZhi()[1]


# ============================================================
# 一、喜神方位
# 口诀：甲己在艮乙庚乾，丙辛坤位喜神安
#       丁壬本在离宫坐，戊癸原来在巽间
# 出处：《协纪辨方书》
# ============================================================

XISHEN_TABLE = {
    "甲": "艮", "己": "艮",  # 东北方
    "乙": "乾", "庚": "乾",  # 西北方
    "丙": "坤", "辛": "坤",  # 西南方
    "丁": "离", "壬": "离",  # 正南方
    "戊": "巽", "癸": "巽",  # 东南方
}


def xishen_fangwei(day_gan: str) -> dict:
    """
    喜神方位。
    口诀："甲己在艮乙庚乾，丙辛坤位喜神安，丁壬本在离宫坐，戊癸原来在巽间"
    出处：《协纪辨方书》
    原理：五虎遁元推丙法——"物以相见为喜"，喜神即"见丙"之位。
          甲己日起丙寅(艮)，乙庚日至丙戌(乾)，丙辛日至丙申(坤)，
          丁壬日至丙午(离)，戊癸日至丙辰(巽)
    """
    bagua = XISHEN_TABLE.get(day_gan, "离")
    direction = BAGUA_TO_DIR[bagua]
    return {
        "rule": "喜神方位（《协纪辨方书》卷二十）",
        "day_gan": day_gan,
        "bagua": bagua,
        "direction": direction,
        "tip": f"今日喜神在{direction}。出门会友、社交约会在{direction}最佳。"
               f"婚嫁迎亲时新娘面朝{direction}为大吉。",
    }


# ============================================================
# 二、财神方位
# 口诀：甲艮乙坤丙丁兑，戊己财神坐坎位，
#       庚辛正东壬癸南，此是财神正方位
# 出处：《协纪辨方书》
# ============================================================

CAISHEN_TABLE = {
    "甲": "艮",                # 东北方
    "乙": "坤",                # 西南方
    "丙": "兑", "丁": "兑",    # 正西方
    "戊": "坎", "己": "坎",    # 正北方
    "庚": "震", "辛": "震",    # 正东方
    "壬": "离", "癸": "离",    # 正南方
}


def caishen_fangwei(day_gan: str) -> dict:
    """财神方位。口诀详见上方。出处：《协纪辨方书》"""
    bagua = CAISHEN_TABLE.get(day_gan, "离")
    direction = BAGUA_TO_DIR[bagua]
    return {
        "rule": "财神方位（《协纪辨方书》）",
        "day_gan": day_gan,
        "bagua": bagua,
        "direction": direction,
        "tip": f"今日财神在{direction}。求财、谈判、签约时面朝{direction}。",
    }


# ============================================================
# 三、福神方位
# 口诀：甲己正北是福神，丙辛西北乾宫存。
#       乙庚坤位戊癸艮，丁壬巽上妙追寻。
# 出处：《协纪辨方书》
# ============================================================

FUSHEN_TABLE = {
    "甲": "坎", "己": "坎",  # 正北方
    "乙": "坤",             # 西南方
    "丙": "乾", "辛": "乾",  # 西北方
    "丁": "巽", "壬": "巽",  # 东南方
    "戊": "艮", "癸": "艮",  # 东北方
    "庚": "坤",             # 西南方
}


def fushen_fangwei(day_gan: str) -> dict:
    """福神方位。口诀详见上方。出处：《协纪辨方书》"""
    bagua = FUSHEN_TABLE.get(day_gan, "坎")
    direction = BAGUA_TO_DIR[bagua]
    return {
        "rule": "福神方位（《协纪辨方书》）",
        "day_gan": day_gan,
        "bagua": bagua,
        "direction": direction,
        "tip": f"今日福神在{direction}。宜居家在此方位活动，祈福纳吉。",
    }


# ============================================================
# 四、天乙贵人
# 口诀：甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，
#       壬癸兔蛇藏，六辛逢马虎，此是贵人方
# 出处：《协纪辨方书》
# ============================================================

TIANYI_TABLE = {
    "甲": ("丑", "未"), "戊": ("丑", "未"), "庚": ("丑", "未"),
    "乙": ("子", "申"), "己": ("子", "申"),
    "丙": ("亥", "酉"), "丁": ("亥", "酉"),
    "壬": ("巳", "卯"), "癸": ("巳", "卯"),
    "辛": ("午", "寅"),
}


def tianyi_guiren(day_gan: str) -> dict:
    """天乙贵人方位。口诀详见上方。出处：《协纪辨方书》"""
    yang, yin = TIANYI_TABLE.get(day_gan, ("丑", "未"))
    return {
        "rule": "天乙贵人（《协纪辨方书》）",
        "day_gan": day_gan,
        "yang_gui": {"zhi": yang, "direction": ZHI_TO_DIRECTION[yang], "time": "白天（日出至日落）"},
        "yin_gui": {"zhi": yin, "direction": ZHI_TO_DIRECTION[yin], "time": "夜晚（日落至日出）"},
        "tip": f"今日贵人：白天在{ZHI_TO_DIRECTION[yang]}（{yang}位），夜晚在{ZHI_TO_DIRECTION[yin]}（{yin}位）。"
               f"遇事不顺时面朝贵人方位，易得贵人相助。",
    }


# ============================================================
# 五、综合每日方位摘要
# ============================================================

def ganzhi_to_fangwei_summary(day_gan: str = None, gregorian_date=None) -> dict:
    """
    一站式查询：给定日期（默认今天），返回所有方位。

    输入：day_gan（日干，如"甲"）或 gregorian_date（datetime.date）
    输出：喜神、财神、福神、天乙贵人的方位汇总
    """
    if day_gan is None and gregorian_date is None:
        day_gan, __day_zhi = ganzhi_of_day()

    result = {
        "date": str(gregorian_date) if gregorian_date else "今天",
        "day_gan": day_gan,
        "喜神": xishen_fangwei(day_gan),
        "财神": caishen_fangwei(day_gan),
        "福神": fushen_fangwei(day_gan),
        "天乙贵人": tianyi_guiren(day_gan),
        "感情社交推荐": {
            "约会方位": xishen_fangwei(day_gan)["direction"],
            "表白方位": xishen_fangwei(day_gan)["direction"],
            "贵人媒介": tianyi_guiren(day_gan)["yang_gui"]["direction"],
        },
    }
    return result
