// api/analyze.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { industry, data } = req.body;
    const geminiKey = process.env.GEMINI_API_KEY;
    const scraperKey = process.env.SCRAPER_API_KEY;

    if (!geminiKey) {
        return res.status(500).json({ error: 'Gemini API key missing' });
    }

    try {
        let textToAnalyze = data;

        // URL check and scraping
        if (data.startsWith('http://') || data.startsWith('https://')) {
            if (!scraperKey) {
                return res.status(500).json({ error: 'Scraper API key missing on server' });
            }
            const scrapeUrl = `https://api.abstractapi.com/v1/webscraper/?api_key=${scraperKey}&url=${encodeURIComponent(data)}`;
            const scrapeResponse = await fetch(scrapeUrl);
            const htmlContent = await scrapeResponse.text();
            textToAnalyze = htmlContent.replace(/<[^>]*>/g, ' ').substring(0, 4000); 
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

        const prompt = `You are an expert fraud and trust analysis AI for the "${industry}" sector.
        Analyze this scraped website/profile text data for red flags, verification status, and fake reviews:
        "${textToAnalyze}"
        
        Respond ONLY with a valid JSON:
        {
            "score": 85,
            "rating": "Excellent",
            "risk": "Low",
            "recommendation": "Write a deep professional 2-line advice here based on the data."
        }`;

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const result = await response.json();
        const responseText = result.candidates[0].content.parts[0].text;
        const cleanJson = responseText.replace(/```json|```/g, '').trim();
        
        return res.status(200).json(JSON.parse(cleanJson));

    } catch (error) {
        return res.status(500).json({ error: 'Multi-API Pipeline Failed', details: error.message });
    }
}

