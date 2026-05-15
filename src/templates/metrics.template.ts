import pptxgen from "pptxgenjs";
import type { Slide } from "../renderers/slide.types";
import { COLORS, FONTS, FONT_SIZES, LAYOUT } from "../renderers/design.constants";

export function renderMetricsTemplate(prs: pptxgen, slide: Slide): void {
  const pSlide = prs.addSlide();

  pSlide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 7.5,
    fill: { color: COLORS.offWhite },
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
      x: LAYOUT.marginX, y: 1.45, w: 12, h: 0.5,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.subtitle,
      color: COLORS.grayDark,
    });
  }

  // Metric cards
  const metrics = (slide.metrics ?? []).filter(Boolean).slice(0, 4);
  const cardW = metrics.length > 0 ? (12.33 / metrics.length) - 0.2 : 3;
  const cardStartY = 2.2;

  metrics.forEach((metric, i) => {
    const cardX = LAYOUT.marginX + i * (cardW + 0.2);

    // Card background
    pSlide.addShape(prs.ShapeType.rect, {
      x: cardX, y: cardStartY, w: cardW, h: 3.2,
      fill: { color: COLORS.white },
      shadow: { type: "outer", blur: 6, offset: 2, angle: 45, color: "CCCCCC", opacity: 0.25 },
      line: { color: COLORS.grayLight, width: 0.5 },
    });

    // Gold top border
    pSlide.addShape(prs.ShapeType.rect, {
      x: cardX, y: cardStartY, w: cardW, h: 0.06,
      fill: { color: COLORS.gold },
      line: { width: 0 },
    });

    // Metric value
    pSlide.addText(metric.value, {
      x: cardX + 0.2, y: cardStartY + 0.5, w: cardW - 0.4, h: 1.5,
      fontFace: FONTS.title,
      fontSize: FONT_SIZES.metricValue,
      color: COLORS.accent,
      bold: true,
      align: "center",
    });

    // Metric label
    pSlide.addText(metric.label.toUpperCase(), {
      x: cardX + 0.2, y: cardStartY + 2.0, w: cardW - 0.4, h: 0.5,
      fontFace: FONTS.tag,
      fontSize: FONT_SIZES.metricLabel,
      color: COLORS.grayDark,
      bold: true,
      charSpacing: 2,
      align: "center",
    });
  });

  // Bullet points below cards
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 3);
  bullets.forEach((point, i) => {
    pSlide.addText(`• ${point}`, {
      x: LAYOUT.marginX, y: 5.65 + i * 0.32, w: 12.33, h: 0.28,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.bullet,
      color: COLORS.grayDark,
    });
  });
}
