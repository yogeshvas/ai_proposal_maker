import pptxgen from "pptxgenjs";
import type { Slide } from "../renderers/slide.types";
import { COLORS, FONTS, FONT_SIZES, LAYOUT } from "../renderers/design.constants";

export function renderArchitectureTemplate(prs: pptxgen, slide: Slide): void {
  const pSlide = prs.addSlide();

  // Dark left panel
  pSlide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 4.5, h: 7.5,
    fill: { color: COLORS.accent },
    line: { width: 0 },
  });

  // White right panel
  pSlide.addShape(prs.ShapeType.rect, {
    x: 4.5, y: 0, w: 8.83, h: 7.5,
    fill: { color: COLORS.white },
    line: { width: 0 },
  });

  // Gold accent line on left
  pSlide.addShape(prs.ShapeType.rect, {
    x: 0.4, y: 0.38, w: 0.32, h: 0.06,
    fill: { color: COLORS.gold },
    line: { width: 0 },
  });

  if (slide.headerTag) {
    pSlide.addText(slide.headerTag.toUpperCase(), {
      x: 0.4, y: 0.52, w: 3.7, h: 0.22,
      fontFace: FONTS.tag,
      fontSize: FONT_SIZES.headerTag,
      color: COLORS.grayMid,
      bold: true,
      charSpacing: 3,
    });
  }

  pSlide.addText(slide.title ?? "", {
    x: 0.4, y: 1.1, w: 3.7, h: 2.0,
    fontFace: FONTS.title,
    fontSize: FONT_SIZES.sectionTitle - 4,
    color: COLORS.white,
    bold: true,
    breakLine: true,
  });

  pSlide.addShape(prs.ShapeType.rect, {
    x: 0.4, y: 3.2, w: 1.1, h: 0.03,
    fill: { color: COLORS.gold },
    line: { width: 0 },
  });

  if (slide.subtitle) {
    pSlide.addText(slide.subtitle, {
      x: 0.4, y: 3.35, w: 3.7, h: 0.8,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.body,
      color: COLORS.grayMid,
      italic: true,
    });
  }

  if (slide.description) {
    pSlide.addText(slide.description, {
      x: 0.4, y: 4.3, w: 3.7, h: 1.2,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.body - 1,
      color: COLORS.grayMid,
    });
  }

  // Right panel — architecture layers
  pSlide.addText("ARCHITECTURE OVERVIEW", {
    x: 4.9, y: 0.35, w: 8, h: 0.25,
    fontFace: FONTS.tag,
    fontSize: FONT_SIZES.headerTag,
    color: COLORS.grayMid,
    bold: true,
    charSpacing: 2,
  });

  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  const layerColors = [COLORS.accentMid, COLORS.accent, COLORS.grayDark, COLORS.grayLight];
  const layerTextColors = [COLORS.white, COLORS.white, COLORS.white, COLORS.black];
  const layerStartY = 0.85;
  const layerH = bullets.length > 0 ? 5.8 / bullets.length : 1.45;

  bullets.forEach((layer, i) => {
    pSlide.addShape(prs.ShapeType.rect, {
      x: 4.9, y: layerStartY + i * (layerH + 0.08), w: 7.9, h: layerH,
      fill: { color: layerColors[i % layerColors.length] },
      line: { width: 0 },
    });

    pSlide.addText(layer, {
      x: 5.1, y: layerStartY + i * (layerH + 0.08) + layerH / 2 - 0.18,
      w: 7.5, h: 0.36,
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.body,
      color: layerTextColors[i % layerTextColors.length],
      bold: true,
    });
  });

  // Connector arrow icon hint
  if (bullets.length > 1) {
    pSlide.addText("↕", {
      x: 12.5, y: 1.5, w: 0.5, h: 5,
      fontFace: FONTS.body,
      fontSize: 22,
      color: COLORS.grayLight,
      valign: "middle",
      align: "center",
    });
  }
}
