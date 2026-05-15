import pptxgen from "pptxgenjs";
import type { Slide } from "../renderers/slide.types";
import { COLORS, FONTS, FONT_SIZES, LAYOUT } from "../renderers/design.constants";

export function renderComparisonTemplate(prs: pptxgen, slide: Slide): void {
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

  // Left panel — "Without" / Before
  pSlide.addShape(prs.ShapeType.rect, {
    x: LAYOUT.marginX, y: 1.6, w: 5.9, h: 5.5,
    fill: { color: COLORS.offWhite },
    line: { color: COLORS.grayLight, width: 0.5 },
  });

  pSlide.addShape(prs.ShapeType.rect, {
    x: LAYOUT.marginX, y: 1.6, w: 5.9, h: 0.45,
    fill: { color: COLORS.grayDark },
    line: { width: 0 },
  });

  pSlide.addText("WITHOUT", {
    x: LAYOUT.marginX + 0.2, y: 1.65, w: 5.5, h: 0.35,
    fontFace: FONTS.tag,
    fontSize: FONT_SIZES.body,
    color: COLORS.white,
    bold: true,
    charSpacing: 2,
  });

  // Right panel — "With" / After
  pSlide.addShape(prs.ShapeType.rect, {
    x: 6.93, y: 1.6, w: 5.9, h: 5.5,
    fill: { color: COLORS.offWhite },
    line: { color: COLORS.accent, width: 1 },
  });

  pSlide.addShape(prs.ShapeType.rect, {
    x: 6.93, y: 1.6, w: 5.9, h: 0.45,
    fill: { color: COLORS.accent },
    line: { width: 0 },
  });

  pSlide.addText("WITH US", {
    x: 7.13, y: 1.65, w: 5.5, h: 0.35,
    fontFace: FONTS.tag,
    fontSize: FONT_SIZES.body,
    color: COLORS.white,
    bold: true,
    charSpacing: 2,
  });

  // VS divider
  pSlide.addShape(prs.ShapeType.ellipse, {
    x: 6.16, y: 3.95, w: 1.0, h: 1.0,
    fill: { color: COLORS.gold },
    line: { width: 0 },
  });

  pSlide.addText("VS", {
    x: 6.16, y: 4.05, w: 1.0, h: 0.7,
    fontFace: FONTS.title,
    fontSize: FONT_SIZES.body + 2,
    color: COLORS.white,
    bold: true,
    align: "center",
  });

  // Split bullets: first half left, second half right
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 6);
  const mid = Math.ceil(bullets.length / 2);
  const leftBullets = bullets.slice(0, mid);
  const rightBullets = bullets.slice(mid);

  leftBullets.forEach((point, i) => {
    pSlide.addText(`✕  ${point}`, {
      x: LAYOUT.marginX + 0.2, y: 2.3 + i * 0.55, w: 5.5, h: 0.45,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.bullet,
      color: COLORS.grayDark,
    });
  });

  rightBullets.forEach((point, i) => {
    pSlide.addText(`✓  ${point}`, {
      x: 7.13, y: 2.3 + i * 0.55, w: 5.5, h: 0.45,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.bullet,
      color: COLORS.accent,
      bold: true,
    });
  });
}
