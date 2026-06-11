"""
星座/星次映射 + 属相星座交叉分析（双源并行）

中国传统维度：
  《汉书·律历志》— 十二星次与地支、二十四节气对应
  《果老星宗》— 七政四余十二宫框架
  地支五行/方位 — 传统干支体系标准推导

西方传统维度：
  Ptolemy《Tetrabiblos》（《占星四书》）
    Book I — 行星守护关系（Domicile Rulership）
    Book III Ch.13 — 星座形态分类（二至/固定/双体）及性格共性
    Book III Ch.14-15 — 行星对灵魂气质的影响
"""

import json
import os

from .taohua import ZODIAC_TO_ZHI, ZHI_TO_ZODIAC, ZHI_TO_DIRECTION

# ============================================================
# 一、西方十二星座 ↔ 中国十二星次 对应（快速查表）
#    星次日期基于二十四节气（每年微调±1天），非西方热带黄道日期
#    出处：《汉书·律历志》十二次-节气对应
# ============================================================

WESTERN_TO_CIZODIAC = {
    "白羊座": ("降娄", "戌", "戌宫", "惊蛰 → 清明", "约3月6日–4月5日"),
    "金牛座": ("大梁", "酉", "酉宫", "清明 → 立夏", "约4月5日–5月6日"),
    "双子座": ("实沈", "申", "申宫", "立夏 → 芒种", "约5月6日–6月6日"),
    "巨蟹座": ("鹑首", "未", "未宫", "芒种 → 小暑", "约6月6日–7月7日"),
    "狮子座": ("鹑火", "午", "午宫", "小暑 → 立秋", "约7月7日–8月7日"),
    "处女座": ("鹑尾", "巳", "巳宫", "立秋 → 白露", "约8月7日–9月8日"),
    "天秤座": ("寿星", "辰", "辰宫", "白露 → 寒露", "约9月8日–10月8日"),
    "天蝎座": ("大火", "卯", "卯宫", "寒露 → 立冬", "约10月8日–11月7日"),
    "射手座": ("析木", "寅", "寅宫", "立冬 → 大雪", "约11月7日–12月7日"),
    "摩羯座": ("星纪", "丑", "丑宫", "大雪 → 小寒", "约12月7日–1月6日"),
    "水瓶座": ("玄枵", "子", "子宫", "小寒 → 立春", "约1月6日–2月4日"),
    "双鱼座": ("娵訾", "亥", "亥宫", "立春 → 惊蛰", "约2月4日–3月6日"),
}

ZODIAC_SIGNS = list(WESTERN_TO_CIZODIAC.keys())
CIZODIAC_TO_ZHI = {v[0]: v[1] for v in WESTERN_TO_CIZODIAC.values()}

# ============================================================
# 二、加载十二星座双维度数据（从 JSON 知识库）
# ============================================================

def _load_sign_data():
    """从 data/signs.json 加载双维度星座数据"""
    json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                             'data', 'signs.json')
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)["signs"]

SIGN_DUAL = _load_sign_data()


def western_to_cizodiac(sign: str) -> dict:
    """西方星座  → 中国星次信息（含节气日期，基于《汉书·律历志》）"""
    info = WESTERN_TO_CIZODIAC.get(sign)
    if not info:
        for k in WESTERN_TO_CIZODIAC:
            if sign in k or k.startswith(sign):
                info = WESTERN_TO_CIZODIAC[k]
                sign = k
                break
    if not info:
        return {"error": f"未知星座: {sign}", "valid": ZODIAC_SIGNS}

    cizodiac_name, zhi, gong, jieqi_range, date_approx = info
    return {
        "sign": sign,
        "cizodiac": cizodiac_name,
        "zhi": zhi,
        "gong": gong,
        "jieqi_range": jieqi_range,     # 节气范围（如"惊蛰 → 清明"）
        "date_approx": date_approx,      # 近似公历日期（基于节气，每年微调±1天）
        "direction": ZHI_TO_DIRECTION.get(zhi, ""),
    }


# ============================================================
# 三、属相 + 星座交叉匹配分析
# ============================================================

def zodiac_sign_match(zodiac: str, sign: str) -> dict:
    """
    属相（地支） + 星座 的交叉分析，双源并行：
    中国传统维度 — 属相地支与星次地支的关系（六合/三合/六冲）
    西方传统维度 — Ptolemy 星座桃花属性
    """
    zhi = ZODIAC_TO_ZHI.get(zodiac)
    sign_info = western_to_cizodiac(sign)
    if not zhi or "error" in sign_info:
        return {"error": "无法匹配属相或星座"}

    sign_zhi = sign_info["zhi"]

    # 地支关系（中国传统体系）
    LIUHE = {"子": "丑", "丑": "子", "寅": "亥", "亥": "寅",
             "卯": "戌", "戌": "卯", "辰": "酉", "酉": "辰",
             "巳": "申", "申": "巳", "午": "未", "未": "午"}
    LIUCHONG = {"子": "午", "午": "子", "丑": "未", "未": "丑",
                "寅": "申", "申": "寅", "卯": "酉", "酉": "卯",
                "辰": "戌", "戌": "辰", "巳": "亥", "亥": "巳"}

    relation = "平"
    relation_desc = ""
    if sign_zhi == zhi:
        relation = "同宫"
        relation_desc = "星次地支与生肖地支完全一致（同宫），个性强烈纯粹，桃花气质鲜明，但容易走极端。"
    elif LIUHE.get(zhi) == sign_zhi:
        relation = "六合（大吉）"
        relation_desc = "生肖地支与星座地支六合，阴阳互补，能量完美融合，为'天作之合'。"
    elif sign_zhi in _sanhe_members(zhi):
        relation = "三合（吉利）"
        relation_desc = "生肖地支与星座地支同属三合局，五行能量相互助力，桃花运有基础。"
    elif LIUCHONG.get(zhi) == sign_zhi:
        relation = "六冲（冲突）"
        relation_desc = "生肖地支与星座地支六冲，能量对冲。桃花来得猛烈但波动大，需谨慎处理。"
    else:
        relation_desc = "生肖地支与星座地支无特殊关系，能量独立运行，属正常范畴。"

    sign_data = SIGN_DUAL.get(sign, {})

    return {
        "生肖": zodiac,
        "生肖地支": zhi,
        "星座": sign_info["sign"],
        # ── 中国传统维度 ──
        "中国星次": {
            "名称": sign_info["cizodiac"],
            "地支": sign_info["zhi"],
            "宫位": sign_info["gong"],
            "五行": sign_data.get("chinese", {}).get("wuxing", ""),
            "阴阳": sign_data.get("chinese", {}).get("yinyang", ""),
            "性格": sign_data.get("chinese", {}).get("character", ""),
            "节气范围": sign_info["jieqi_range"],
            "近似公历": sign_info["date_approx"],
            "历法": "农历节气（太阳黄经，每年微调±1天）",
            "出处": "《汉书·律历志》十二次 +《果老星宗》七政四余十二宫框架",
        },
        # ── 地支交叉关系 ──
        "地支关系": relation,
        "关系解读": relation_desc,
        # ── 西方传统维度 ──
        "西方星座": {
            "主宰星": sign_data.get("western", {}).get("planet", ""),
            "元素": sign_data.get("western", {}).get("element", ""),
            "形态": sign_data.get("western", {}).get("mode", ""),
            "桃花风格": sign_data.get("western", {}).get("personality", ""),
            "公历日期": sign_data.get("western", {}).get("date_range", ""),
            "历法": sign_data.get("western", {}).get("calendar", "公历（热带黄道）"),
            "古典出处": sign_data.get("western", {}).get("classical_note", ""),
            "出处": "Ptolemy《Tetrabiblos》（《占星四书》）Book I + Book III",
            "最佳配对": sign_data.get("western", {}).get("best_match", []),
            "配对原理": sign_data.get("western", {}).get("best_match_reason", ""),
        },
        # ── 方位 ──
        "桃花方位_属相": ZHI_TO_DIRECTION.get(zhi, ""),
        "桃花方位_星座": sign_info["direction"],
    }


def _sanhe_members(zhi: str) -> list:
    """返回某个地支所在三合局的另两个成员"""
    sanhe = {
        "申": ["子", "辰"], "子": ["申", "辰"], "辰": ["申", "子"],
        "亥": ["卯", "未"], "卯": ["亥", "未"], "未": ["亥", "卯"],
        "寅": ["午", "戌"], "午": ["寅", "戌"], "戌": ["寅", "午"],
        "巳": ["酉", "丑"], "酉": ["巳", "丑"], "丑": ["巳", "酉"],
    }
    return sanhe.get(zhi, [])
