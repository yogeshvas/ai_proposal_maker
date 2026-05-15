import axios from "axios";
import { sanitizeImageQuery } from "./imageQurtyOptimier";

export const getUnsplashImage = async (
    query: string,
    orientation: string = "landscape",
    usedUrls: Set<string> = new Set()
): Promise<string | null> => {
    try {
        const safeQuery = sanitizeImageQuery(query);
        const safeOrientation = orientation === "square" ? "squarish" : orientation;

        console.log("Searching:", safeQuery);

        const response = await axios.get(
            "https://api.unsplash.com/search/photos",
            {
                params: {
                    query: safeQuery,
                    per_page: 20,
                    page: Math.floor(Math.random() * 3) + 1,
                    orientation: safeOrientation,
                    order_by: "relevant",
                },
                headers: {
                    Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY?.trim()}`,
                },
            }
        );

        console.log("Unsplash results:", response.data.total);

        const results: any[] = response.data.results ?? [];
        if (results.length === 0) {
            console.log("No image found:", safeQuery);
            return null;
        }

        // Pick the first result that hasn't been used yet
        const fresh = results.find(r => !usedUrls.has(r.urls.regular));
        const image = fresh ?? results[0];

        return image.urls.regular;
    } catch (error: any) {
        console.log("Unsplash error:", error?.response?.data || error.message);
        return null;
    }
};
