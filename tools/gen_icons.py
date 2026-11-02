# -*- coding: utf-8 -*-
"""生成 tabBar 与功能入口所需的 PNG 图标（纯几何绘制，无外部依赖）。"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
os.makedirs(OUT, exist_ok=True)

S = 4          # 超采样倍数
SZ = 81        # 微信 tabBar 推荐 81x81
C_ON = (29, 78, 137, 255)     # --primary #1D4E89
C_OFF = (124, 139, 150, 255)  # --text-3 #7C8B96


def canvas():
    return Image.new("RGBA", (SZ * S, SZ * S), (0, 0, 0, 0))


def finish(img, name):
    img = img.resize((SZ, SZ), Image.LANCZOS)
    img.save(os.path.join(OUT, name))


def sc(x):
    return int(x * S)


def draw_work(d, c):
    w = max(2, int(2.6 * S))
    # 仪表盘：四个圆角块
    blocks = [(14, 14, 36, 36), (45, 14, 67, 34), (14, 45, 36, 67), (45, 43, 67, 67)]
    for i, (x1, y1, x2, y2) in enumerate(blocks):
        if i == 0:
            d.rounded_rectangle([sc(x1), sc(y1), sc(x2), sc(y2)], radius=sc(4), fill=c)
        else:
            d.rounded_rectangle([sc(x1), sc(y1), sc(x2), sc(y2)], radius=sc(4),
                                outline=c, width=w)


def draw_project(d, c):
    w = max(2, int(2.6 * S))
    # 楼宇
    d.rounded_rectangle([sc(16), sc(22), sc(42), sc(70)], radius=sc(3), outline=c, width=w)
    d.rounded_rectangle([sc(40), sc(34), sc(66), sc(70)], radius=sc(3), outline=c, width=w)
    # 窗户
    for y in (32, 44):
        for x in (24, 32):
            d.rectangle([sc(x), sc(y), sc(x + 4), sc(y + 4)], fill=c)
    for y in (44, 56):
        d.rectangle([sc(48), sc(y), sc(52), sc(y + 4)], fill=c)
        d.rectangle([sc(58), sc(y), sc(62), sc(y + 4)], fill=c)
    d.line([sc(40), sc(70), sc(40), sc(26)], fill=c, width=w)


def draw_customer(d, c):
    w = max(2, int(2.6 * S))
    # 头像
    d.ellipse([sc(30), sc(14), sc(52), sc(36)], outline=c, width=w)
    # 肩膀
    d.arc([sc(18), sc(40), sc(64), sc(86)], start=200, end=340, fill=c, width=w)


def draw_finance(d, c):
    w = max(2, int(2.6 * S))
    # 钱袋/账本
    d.rounded_rectangle([sc(16), sc(26), sc(64), sc(68)], radius=sc(6), outline=c, width=w)
    d.line([sc(16), sc(42), sc(64), sc(42)], fill=c, width=w)
    # 硬币
    d.ellipse([sc(30), sc(48), sc(50), sc(62)], outline=c, width=w)
    # 提手
    d.arc([sc(28), sc(8), sc(52), sc(30)], start=180, end=360, fill=c, width=w)


def draw_mine(d, c):
    w = max(2, int(2.6 * S))
    d.ellipse([sc(29), sc(12), sc(53), sc(36)], outline=c, width=w)
    d.arc([sc(12), sc(38), sc(70), sc(96)], start=200, end=340, fill=c, width=w)
    # 底座
    d.line([sc(20), sc(68), sc(62), sc(68)], fill=c, width=w)


TABS = [
    ("tab_work", draw_work),
    ("tab_project", draw_project),
    ("tab_customer", draw_customer),
    ("tab_finance", draw_finance),
    ("tab_mine", draw_mine),
]


def main():
    for name, fn in TABS:
        for suffix, color in (("", C_OFF), ("_on", C_ON)):
            img = canvas()
            fn(ImageDraw.Draw(img), color)
            finish(img, f"{name}{suffix}.png")
    print("icons generated:", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
