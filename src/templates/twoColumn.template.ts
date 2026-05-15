import pptxgen from "pptxgenjs";
import type { Slide } from "../renderers/slide.types";
import { COLORS, FONTS, FONT_SIZES, LAYOUT } from "../renderers/design.constants";

export function renderTwoColumnTemplate(prs: pptxgen, slide: Slide): void {
  const pSlide = prs.addSlide();

  // White background
  pSlide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 7.5,
    fill: { color: COLORS.white },
    line: { width: 0 },
  });

  // Top accent bar
  pSlide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.06,
    fill: { color: COLORS.accent },
    line: { width: 0 },
  });

  // Header tag
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

  // Title
  pSlide.addText(slide.title ?? "", {
    x: LAYOUT.marginX, y: 0.5, w: 12, h: 0.85,
    fontFace: FONTS.title,
    fontSize: FONT_SIZES.slideTitle,
    color: COLORS.black,
    bold: true,
  });

  // Title underline
  pSlide.addShape(prs.ShapeType.rect, {
    x: LAYOUT.marginX, y: 1.3, w: 0.9, h: 0.03,
    fill: { color: COLORS.gold },
    line: { width: 0 },
  });

  // Vertical divider
  pSlide.addShape(prs.ShapeType.rect, {
    x: 6.66, y: 1.5, w: 0.02, h: 5.5,
    fill: { color: COLORS.grayLight },
    line: { width: 0 },
  });

  // Left column — description + bullets
  if (slide.description) {
    pSlide.addText(slide.description, {
      x: LAYOUT.marginX, y: 1.55, w: 5.9, h: 1.1,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.body,
      color: COLORS.grayDark,
    });
  }

  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  bullets.forEach((point, i) => {
    pSlide.addText(`• ${point}`, {
      x: LAYOUT.marginX, y: 2.75 + i * 0.45, w: 5.9, h: 0.4,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.bullet,
      color: COLORS.black,
    });
  });

  // Right column — image or subtitle
  if (slide.imageUrl) {
    pSlide.addImage({
      path: slide.imageUrl,
      x: 6.9, y: 1.55, w: 5.9, h: 5.5,
    });
    pSlide.addShape(prs.ShapeType.rect, {
      x: 6.9, y: 1.55, w: 5.9, h: 5.5,
      fill: { color: COLORS.accentBlue, transparency: 75 },
      line: { width: 0 },
    });
  }

  if (slide.subtitle) {
    pSlide.addText(slide.subtitle, {
      x: 6.9, y: 1.6, w: 5.9, h: 0.7,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.subtitle,
      color: slide.imageUrl ? COLORS.white : COLORS.grayDark,
      italic: true,
    });
  }
}
