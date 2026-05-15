import pptxgen from "pptxgenjs";
import type { Slide } from "../renderers/slide.types";
import { COLORS, FONTS, FONT_SIZES, LAYOUT } from "../renderers/design.constants";

export function renderHeroTemplate(prs: pptxgen, slide: Slide): void {
  const pSlide = prs.addSlide();

  // Full-bleed image right half
  if (slide.imageUrl) {
    pSlide.addImage({
      path: slide.imageUrl,
      x: 6.5,
      y: 0,
      w: 6.83,
      h: 7.5,
    });
  }

  // Dark overlay on image side
  pSlide.addShape(prs.ShapeType.rect, {
    x: 6.5,
    y: 0,
    w: 6.83,
    h: 7.5,
    fill: { color: COLORS.accent, transparency: 40 },
    line: { color: COLORS.accent, width: 0 },
  });

  // Left content panel — white
  pSlide.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 6.5,
    h: 7.5,
    fill: { color: COLORS.white },
    line: { width: 0 },
  });

  // Gold accent bar
  pSlide.addShape(prs.ShapeType.rect, {
    x: LAYOUT.marginX,
    y: 0.38,
    w: 0.32,
    h: 0.06,
    fill: { color: COLORS.gold },
    line: { width: 0 },
  });

  // Header tag
  if (slide.headerTag) {
    pSlide.addText(slide.headerTag.toUpperCase(), {
      x: LAYOUT.marginX,
      y: 0.48,
      w: 5.5,
      h: 0.22,
      fontFace: FONTS.tag,
      fontSize: FONT_SIZES.headerTag,
      color: COLORS.grayDark,
      bold: true,
      charSpacing: 3,
    });
  }

  // Main title
  pSlide.addText(slide.title ?? "", {
    x: LAYOUT.marginX,
    y: 1.6,
    w: 5.6,
    h: 2.4,
    fontFace: FONTS.title,
    fontSize: FONT_SIZES.coverTitle,
    color: COLORS.black,
    bold: true,
    breakLine: true,
  });

  // Divider line
  pSlide.addShape(prs.ShapeType.rect, {
    x: LAYOUT.marginX,
    y: 4.15,
    w: 1.2,
    h: 0.03,
    fill: { color: COLORS.gold },
    line: { width: 0 },
  });

  // Subtitle
  if (slide.subtitle) {
    pSlide.addText(slide.subtitle, {
      x: LAYOUT.marginX,
      y: 4.3,
      w: 5.6,
      h: 0.7,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.coverSubtitle,
      color: COLORS.grayDark,
      italic: true,
    });
  }

  // Bullet points
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  bullets.forEach((point, i) => {
    pSlide.addText(`• ${point}`, {
      x: LAYOUT.marginX,
      y: 5.1 + i * 0.32,
      w: 5.6,
      h: 0.3,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.bullet,
      color: COLORS.grayDark,
    });
  });

  // Footer
  pSlide.addText("CONFIDENTIAL", {
    x: LAYOUT.marginX,
    y: 7.1,
    w: 3,
    h: 0.2,
    fontFace: FONTS.tag,
    fontSize: FONT_SIZES.footerTag,
    color: COLORS.grayMid,
    charSpacing: 2,
  });
}
