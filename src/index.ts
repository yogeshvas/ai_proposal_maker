import { urlencoded } from "body-parser"
import express from "express"
import dotenv from "dotenv"
import OpenAI from "openai"
import path from "path"
import { XMLParser } from "fast-xml-parser";
import { finePrompt } from "./constants/fineprompt";
import { proposalAgentStrategist } from "./agents/proposalAgentStrategist";
import { layoutSelectorAgent } from "./agents/layoutSelectorAgent";
import { slideCreationAgent } from "./agents/slideCreationAgent";
import { getUnsplashImage } from "./services/unsplash.service";
import { generateIllustration, IMAGES_DIR } from "./services/illustration.service";
import { generatePDF, needsPhoto } from "./renderers/pdf.renderer";

dotenv.config()

// Layouts that REQUIRE bulletPoints to render non-empty
const BULLET_REQUIRED_LAYOUTS = new Set([
    "numbered_steps_callout", "dark_steps", "icon_grid", "challenge_grid",
    "tech_ecosystem", "process_donut", "dark_flow",
    "arrow_pipeline", "pyramid_tiers", "circular_flow",
]);

// If AI forgot to fill bulletPoints for a layout that needs them, synthesize from description/subtitle
function hydrateSlide(slide: any): any {
    const layout = slide.recommendedLayout ?? "";
    if (!BULLET_REQUIRED_LAYOUTS.has(layout)) return slide;
    const bullets: string[] = (slide.bulletPoints ?? []).filter(Boolean);
    if (bullets.length >= 2) return slide;

    const desc: string = slide.description ?? "";
    const sub: string  = slide.subtitle ?? "";

    // Try comma-split of description (catches "A, B, C, and D" patterns)
    const commaParts = desc.split(/[,;]/)
        .map((s: string) => s.trim().replace(/^(and|or)\s+/i, ""))
        .filter((s: string) => s.length > 8);
    if (commaParts.length >= 3) {
        return { ...slide, bulletPoints: commaParts.slice(0, 4) };
    }

    // Try sentence-split
    const sentences = desc.split(/[.!?]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 15);
    if (sentences.length >= 2) {
        return { ...slide, bulletPoints: sentences.slice(0, 4) };
    }

    // Use subtitle as a single bullet if it's meaningful
    if (sub.length > 20) {
        return { ...slide, bulletPoints: [sub] };
    }

    return slide;
}

const app = express()

app.use(express.json())
app.use(express.urlencoded());

// Serve generated images so they're viewable in browser at /images/<filename>
app.use("/images", express.static(IMAGES_DIR));

// List all saved AI-generated images
app.get("/images", async (_req, res) => {
    try {
        const fs = await import("fs");
        if (!fs.existsSync(IMAGES_DIR)) {
            return res.json({ images: [] });
        }
        const files = fs.readdirSync(IMAGES_DIR)
            .filter(f => f.endsWith(".png"))
            .sort()
            .reverse() // newest first
            .map(f => ({
                fileName: f,
                url: `/images/${f}`,
                createdAt: f.split("_")[0],
            }));
        res.json({ count: files.length, images: files });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/health", (req, res) => {
    res.status(200).json({ success: true, message: "status is healthy" })
})

// main pipeline route
app.post("/generate", async (req, res) => {

    try {

        const start = Date.now();

        const { noOfSlides: rawSlides = 15 } = req.body;
        const noOfSlides = Math.min(Math.max(parseInt(String(rawSlides)) || 15, 5), 21);

        const strategist = await proposalAgentStrategist(req.body, noOfSlides);

        const { analysis, deck } = strategist;

        // Layout Intelligence Agent — reviews all slides and assigns optimal layouts
        console.log("[LayoutSelector] assigning layouts...");
        deck.slides = await layoutSelectorAgent(deck.slides, deck.deckTitle, deck.storyTheme);
        console.log("[LayoutSelector] done");

        // Enforce layout variety: no layout may appear more than twice
        const LAYOUT_SUBS = [
          "text_chart", "text_flow", "two_column", "flow_kpi",
          "image_left", "image_right", "comparison", "minimal",
          "process_donut", "numbered_steps_callout",
        ];
        const layoutCount: Record<string, number> = {};
        const subCount: Record<string, number> = {};
        for (const s of deck.slides) {
          const l = s.recommendedLayout;
          if (!l) continue;
          layoutCount[l] = (layoutCount[l] ?? 0) + 1;
          if (layoutCount[l] > 2) {
            const alt = LAYOUT_SUBS.find(a => (subCount[a] ?? 0) < 2 && a !== l);
            if (alt) {
              s.recommendedLayout = alt;
              subCount[alt] = (subCount[alt] ?? 0) + 1;
            }
          }
        }

        // Enrich analysis with raw client context
        const enrichedAnalysis = {
            ...analysis,
            _client: {
                name: req.body.companyName,
                industry: req.body.industry,
                subIndustry: req.body.subIndustry,
                region: req.body.metaData?.region,
                primaryUseCases: req.body.metaData?.primaryUseCases,
                integrationNeeds: req.body.metaData?.integrationNeeds,
                salesObjective: req.body.metaData?.salesObjective,
                brandTone: req.body.metaData?.brandTone,
            },
            _product: { name: req.body.productName },
        };

        const generatedSlides = (await Promise.all(
            deck.slides.map((slide: any) =>
                slideCreationAgent(enrichedAnalysis, deck.storyTheme, slide)
            )
        )).map((slide: any, index: number) => ({
            ...slide,
            slideNumber: deck.slides[index].slideNumber,
            slideType: slide.slideType || deck.slides[index].slideType,
            recommendedLayout: slide.recommendedLayout || deck.slides[index].recommendedLayout,
        })).map(hydrateSlide);

        // Image strategy: 2 AI illustrations per deck
        //   Slot 1 → cover / hero slide
        //   Slot 2 → first mid-deck image slide (quote_image, image_left, image_right)
        //   Everything else → Unsplash (free)
        const AI_IMAGE_LIMIT = 2;
        const IMAGE_LAYOUTS = new Set(["quote_image", "image_left", "image_right"]);

        // Decide which slide indices get AI images
        let aiSlotsRemaining = AI_IMAGE_LIMIT;
        const aiSlotSet = new Set<number>();
        for (let i = 0; i < generatedSlides.length && aiSlotsRemaining > 0; i++) {
            const slide = generatedSlides[i];
            const isCover = slide.slideType === "cover" || slide.recommendedLayout === "hero";
            const isMidImage = IMAGE_LAYOUTS.has(slide.recommendedLayout ?? "");
            if (isCover || isMidImage) {
                aiSlotSet.add(i);
                aiSlotsRemaining--;
            }
        }

        const usedImageUrls = new Set<string>();
        const dalleErrors: string[] = [];
        const generatedImages: Array<{ slideIndex: number; fileName: string; viewUrl: string } | null> = [];

        const images: (string | null)[] = await Promise.all(
            generatedSlides.map(async (slide: any, index: number) => {
                if (!needsPhoto(slide)) {
                    generatedImages[index] = null;
                    return null;
                }

                if (aiSlotSet.has(index)) {
                    try {
                        const result = await generateIllustration(slide.slideType ?? "cover", slide.title ?? "");
                        if (result) {
                            generatedImages[index] = {
                                slideIndex: index + 1,
                                fileName: result.fileName,
                                viewUrl: `http://localhost:3000${result.httpPath}`,
                            };
                            return result.fileUrl; // data URI — loads in Puppeteer with no restrictions
                        }
                    } catch (aiErr: any) {
                        const msg = aiErr?.message ?? String(aiErr);
                        console.error("[Illustration error]", msg);
                        dalleErrors.push(`Slide ${index + 1}: ${msg}`);
                    }
                }

                generatedImages[index] = null;
                const url = await getUnsplashImage(
                    slide.visualRequirements?.searchQuery ?? "business meeting",
                    slide.visualRequirements?.orientation ?? "landscape",
                    usedImageUrls
                );
                if (url) usedImageUrls.add(url);
                return url ?? null;
            })
        );

        const finalSlides = generatedSlides.map((slide: any, index: number) => ({
            ...slide,
            imageUrl: images[index],
        }));

        const pdfPath = await generatePDF(deck.deckTitle, finalSlides, deck.storyTheme);

        console.log("Pipeline:", Date.now() - start, "ms");

        res.status(200).json({
            deckTitle: deck.deckTitle,
            storyTheme: deck.storyTheme,
            pdfPath,
            aiImages: generatedImages.filter(Boolean).map(img => img!.viewUrl),
            // If DALL-E failed, errors show here so you can diagnose
            dalleErrors: dalleErrors.length ? dalleErrors : undefined,
            slides: finalSlides,
        });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/test-unsplash", async (req, res) => {
    try {
        const image = await getUnsplashImage("office");
        res.json({ image });
    } catch (error: any) {
        res.json({ error: error.message });
    }
});

// Quick test: hit this to check if DALL-E is accessible on your account
app.get("/test-dalle", async (req, res) => {
    try {
        const result = await generateIllustration("cover", "Test illustration");
        res.json({
            success: true,
            fileName: result?.fileName,
            viewUrl: result ? `http://localhost:3000${result.httpPath}` : null,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error?.message ?? String(error),
            hint: "Check your OPEN_AI_KEY has DALL-E 3 access and billing is active",
        });
    }
});

app.listen(3000, () => {
    console.log("Server is running at Port", 3000)
})
