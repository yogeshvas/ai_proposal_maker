import pptxgen from "pptxgenjs";
import type { Slide } from "../renderers/slide.types";
import { COLORS, FONTS, FONT_SIZES, LAYOUT } from "../renderers/design.constants";

export function renderImageLeftTemplate(prs: pptxgen, slide: Slide): void {
  const pSlide = prs.addSlide();

  pSlide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 7.5,
    fill: { color: COLORS.white },
    line: { width: 0 },
  });

  pSlide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.06,
    fill: { color: COLORS.accent },
    line: { width: 0 },
  });

  // Image — left side
  if (slide.imageUrl) {
    pSlide.addImage({
      path: slide.imageUrl,
      x: 0, y: 0.06, w: 5.8, h: 7.44,
    });
    pSlide.addShape(prs.ShapeType.rect, {
      x: 0, y: 0.06, w: 5.8, h: 7.44,
      fill: { color: COLORS.accent, transparency: 60 },
      line: { width: 0 },
    });
  }

  const textX = 6.2;
  const textW = 6.7;

  if (slide.headerTag) {
    pSlide.addText(slide.headerTag.toUpperCase(), {
      x: textX, y: 0.2, w: textW, h: 0.22,
      fontFace: FONTS.tag,
      fontSize: FONT_SIZES.headerTag,
      color: COLORS.grayMid,
      bold: true,
      charSpacing: 3,
    });
  }

  pSlide.addText(slide.title ?? "", {
    x: textX, y: 0.5, w: textW, h: 1.5,
    fontFace: FONTS.title,
    fontSize: FONT_SIZES.slideTitle,
    color: COLORS.black,
    bold: true,
    breakLine: true,
  });

  pSlide.addShape(prs.ShapeType.rect, {
    x: textX, y: 2.05, w: 0.9, h: 0.03,
    fill: { color: COLORS.gold },
    line: { width: 0 },
  });

  if (slide.subtitle) {
    pSlide.addText(slide.subtitle, {
      x: textX, y: 2.2, w: textW, h: 0.55,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.subtitle,
      color: COLORS.grayDark,
      italic: true,
    });
  }

  if (slide.description) {
    pSlide.addText(slide.description, {
      x: textX, y: 2.85, w: textW, h: 0.9,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.body,
      color: COLORS.grayDark,
    });
  }

  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  bullets.forEach((point, i) => {
    pSlide.addText(`• ${point}`, {
      x: textX, y: 3.85 + i * 0.48, w: textW, h: 0.4,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.bullet,
      color: COLORS.black,
    });
  });
}
