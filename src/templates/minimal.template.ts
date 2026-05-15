import pptxgen from "pptxgenjs";
import type { Slide } from "../renderers/slide.types";
import { COLORS, FONTS, FONT_SIZES, LAYOUT } from "../renderers/design.constants";

export function renderMinimalTemplate(prs: pptxgen, slide: Slide): void {
  const pSlide = prs.addSlide();

  pSlide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 7.5,
    fill: { color: COLORS.white },
    line: { width: 0 },
  });

  // Thin left accent strip
  pSlide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 0.08, h: 7.5,
    fill: { color: COLORS.accent },
    line: { width: 0 },
  });

  if (slide.headerTag) {
    pSlide.addText(slide.headerTag.toUpperCase(), {
      x: 0.5, y: 0.4, w: 12, h: 0.22,
      fontFace: FONTS.tag,
      fontSize: FONT_SIZES.headerTag,
      color: COLORS.grayMid,
      bold: true,
      charSpacing: 3,
    });
  }

  pSlide.addText(slide.title ?? "", {
    x: 0.5, y: 2.5, w: 12.3, h: 1.5,
    fontFace: FONTS.title,
    fontSize: FONT_SIZES.coverTitle - 4,
    color: COLORS.black,
    bold: true,
    align: "center",
  });

  pSlide.addShape(prs.ShapeType.rect, {
    x: 5.66, y: 4.1, w: 2.0, h: 0.04,
    fill: { color: COLORS.gold },
    line: { width: 0 },
  });

  if (slide.subtitle) {
    pSlide.addText(slide.subtitle, {
      x: 1.5, y: 4.3, w: 10.33, h: 0.6,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.subtitle,
      color: COLORS.grayDark,
      align: "center",
      italic: true,
    });
  }

  if (slide.description) {
    pSlide.addText(slide.description, {
      x: 2, y: 5.1, w: 9.33, h: 0.8,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.body,
      color: COLORS.grayDark,
      align: "center",
    });
  }

  // Footer bottom bar
  pSlide.addShape(prs.ShapeType.rect, {
    x: 0, y: 7.3, w: 13.33, h: 0.2,
    fill: { color: COLORS.offWhite },
    line: { width: 0 },
  });

  pSlide.addText("CONFIDENTIAL", {
    x: LAYOUT.marginX, y: 7.32, w: 3, h: 0.16,
    fontFace: FONTS.tag,
    fontSize: FONT_SIZES.footerTag,
    color: COLORS.grayMid,
    charSpacing: 2,
  });
}
