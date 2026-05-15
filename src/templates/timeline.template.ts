import pptxgen from "pptxgenjs";
import type { Slide } from "../renderers/slide.types";
import { COLORS, FONTS, FONT_SIZES, LAYOUT } from "../renderers/design.constants";

export function renderTimelineTemplate(prs: pptxgen, slide: Slide): void {
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

  if (slide.headerTag) {
    pSlide.addText(slide.headerTag.toUpperCase(), {
      x: LAYOUT.marginX, y: 0.2, w: 12, h: 0.22,
      fontFace: FONTS.tag,
      fontSize: FONT_SIZES.headerTag,
      color: COLORS.grayMid,
      bold: true,
      charSpacing: 3,
    });
  }

  pSlide.addText(slide.title ?? "", {
    x: LAYOUT.marginX, y: 0.5, w: 12, h: 0.85,
    fontFace: FONTS.title,
    fontSize: FONT_SIZES.slideTitle,
    color: COLORS.black,
    bold: true,
  });

  pSlide.addShape(prs.ShapeType.rect, {
    x: LAYOUT.marginX, y: 1.3, w: 0.9, h: 0.03,
    fill: { color: COLORS.gold },
    line: { width: 0 },
  });

  if (slide.subtitle) {
    pSlide.addText(slide.subtitle, {
      x: LAYOUT.marginX, y: 1.45, w: 12, h: 0.4,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.subtitle,
      color: COLORS.grayDark,
    });
  }

  // Horizontal spine
  const spineY = 3.9;
  pSlide.addShape(prs.ShapeType.rect, {
    x: LAYOUT.marginX, y: spineY, w: 12.33, h: 0.04,
    fill: { color: COLORS.grayLight },
    line: { width: 0 },
  });

  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  const phaseW = bullets.length > 0 ? 12.33 / bullets.length : 3;

  const phaseColors = [COLORS.accent, COLORS.accentMid, COLORS.grayDark, COLORS.gold];

  bullets.forEach((phase, i) => {
    const nodeX = LAYOUT.marginX + i * phaseW + phaseW / 2;

    // Node circle indicator
    pSlide.addShape(prs.ShapeType.ellipse, {
      x: nodeX - 0.15, y: spineY - 0.15, w: 0.3, h: 0.3,
      fill: { color: phaseColors[i % phaseColors.length] },
      line: { width: 0 },
    });

    // Phase label (alternating top/bottom)
    const isTop = i % 2 === 0;
    const labelY = isTop ? spineY - 1.8 : spineY + 0.4;

    pSlide.addShape(prs.ShapeType.rect, {
      x: nodeX - phaseW / 2 + 0.1, y: isTop ? spineY - 2.2 : spineY + 0.25,
      w: phaseW - 0.2, h: isTop ? 1.8 : 1.8,
      fill: { color: COLORS.offWhite },
      line: { color: COLORS.grayLight, width: 0.5 },
    });

    pSlide.addText(`Phase ${i + 1}`, {
      x: nodeX - phaseW / 2 + 0.2,
      y: isTop ? spineY - 2.1 : spineY + 0.35,
      w: phaseW - 0.4, h: 0.25,
      fontFace: FONTS.tag,
      fontSize: FONT_SIZES.footerTag + 1,
      color: phaseColors[i % phaseColors.length],
      bold: true,
      charSpacing: 1,
    });

    pSlide.addText(phase, {
      x: nodeX - phaseW / 2 + 0.2,
      y: isTop ? spineY - 1.8 : spineY + 0.65,
      w: phaseW - 0.4, h: 1.3,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.body,
      color: COLORS.black,
      wrap: true,
    });
  });
}
