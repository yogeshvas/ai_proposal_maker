import { urlencoded } from "body-parser"
import express from "express"
import dotenv from "dotenv"
import OpenAI from "openai"
import { XMLParser } from "fast-xml-parser";
import { finePrompt } from "./constants/fineprompt";
import e from "express";
import { problemSolutionAgent } from "./agents/problemSolutionAgent";
import { deckPlannerAgent } from "./agents/deckPlannerAgent";
import { proposalAgentStrategist } from "./agents/proposalAgentStrategist";
import { slideCreationAgent } from "./agents/slideCreationAgent";
import { getUnsplashImage } from "./services/unsplash.service";
import { generatePDF, needsPhoto } from "./renderers/pdf.renderer";

dotenv.config()

const app = express()

app.use(express.json())
app.use(express.urlencoded());

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "status is healthy"
    })
})
// this was testing route
app.post("/build", async (req, res) => {
    // ask the user no of slides || 7
    const { prompt, noOfSlides = 7 } = req.body;


    const client = new OpenAI(
        {
            apiKey: process.env.OPEN_AI_KEY
        }
    )

    // get prompt, give context to ai to generate a ppt prompt

    // images what images on each slide looks with ai
    // get images via usplash
    // add images and content
    // generate a pdf


    const response = await client.responses.create({
        model: "gpt-5.1",
        input: finePrompt.toString()
    })

    const parser = new XMLParser({
        ignoreAttributes: false,
        trimValues: true
    });
    const parsed = parser.parse(response.output_text);


    res.status(200).json(parsed)
})

// main pipeline route
app.post("/generate", async (req, res) => {

    try {

        const start =
            Date.now();

        const { noOfSlides: rawSlides = 15 } = req.body;
        const noOfSlides = Math.min(Math.max(parseInt(String(rawSlides)) || 15, 5), 21);

        const strategist =
            await proposalAgentStrategist(
                req.body,
                noOfSlides
            );

        const {
            analysis,
            deck
        } = strategist;

        // Enrich analysis with raw client context so slide agent can name-drop correctly
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
            _product: {
                name: req.body.productName,
            },
        };

        const slidePromises =
            deck.slides.map(
                (slide: any) =>
                    slideCreationAgent(
                        enrichedAnalysis,
                        deck.storyTheme,
                        slide
                    )
            );

        const generatedSlides =
            (await Promise.all(slidePromises)).map(
                (slide: any, index: number) => ({
                    ...slide,
                    slideNumber: deck.slides[index].slideNumber,
                    slideType: slide.slideType || deck.slides[index].slideType,
                    recommendedLayout: slide.recommendedLayout || deck.slides[index].recommendedLayout,
                })
            );

        // Only fetch photos for layouts that display them (hero, image_left, image_right, quote_image)
        const usedImageUrls = new Set<string>();
        const images: (string | null)[] = [];

        for (const slide of generatedSlides) {
            if (!needsPhoto(slide)) {
                images.push(null);
                continue;
            }
            const url = await getUnsplashImage(
                slide.visualRequirements?.searchQuery ?? "business meeting",
                slide.visualRequirements?.orientation ?? "landscape",
                usedImageUrls
            );
            if (url) usedImageUrls.add(url);
            images.push(url);
        }

        const finalSlides =
            generatedSlides.map(
                (
                    slide: any,
                    index: number
                ) => ({
                    ...slide,

                    imageUrl:
                        images[index]
                })
            );

        const pdfPath = await generatePDF(
            deck.deckTitle,
            finalSlides,
            deck.storyTheme
        );

        console.log(
            "Pipeline:",
            Date.now() - start,
            "ms"
        );

        res.status(200).json({
            deckTitle:
                deck.deckTitle,

            storyTheme:
                deck.storyTheme,

            slides:
                finalSlides,

            pdfPath,
        });

    } catch (error: any) {

        console.error(
            error
        );

        res.status(500).json({
            error:
                error.message
        });
    }
});

app.get("/test-unsplash", async (req, res) => {

    try {

        const image =
            await getUnsplashImage(
                "office"
            );

        res.json({
            image
        });

    } catch (error: any) {

        console.log(error);

        res.json({
            error:
                error.message
        });
    }
});
app.listen(3000, () => {
    console.log("Server is running at Port", 3000)
})
