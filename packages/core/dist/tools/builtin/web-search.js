// Web Search tool - search the web for information
// Strategy: DuckDuckGo Instant Answer API → HTML search fallback
const MAX_RESULTS_DEFAULT = 10;
const MAX_RESULTS_LIMIT = 20;
export const webSearchTool = {
    name: 'web_search',
    description: 'Search the web for information. Returns relevant snippets and URLs. Useful for finding documentation, current events, or answers to questions. Can search news specifically when the query requires up-to-date information.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query (1-100 characters)',
            },
            num_results: {
                type: 'number',
                description: `Maximum number of results to return (default: ${MAX_RESULTS_DEFAULT}, max: ${MAX_RESULTS_LIMIT})`,
            },
        },
        required: ['query'],
    },
    async execute(params, context) {
        const query = params.query.trim();
        const numResults = Math.min(Math.max(params.num_results || MAX_RESULTS_DEFAULT, 1), MAX_RESULTS_LIMIT);
        if (!query || query.length > 200) {
            return {
                content: 'Error: query must be 1-200 characters.',
                isError: true,
            };
        }
        try {
            // Phase 1: DuckDuckGo Instant Answer API (fast, structured)
            const instantResults = await fetchInstantAnswer(query);
            // Phase 2: HTML search fallback for richer results
            const htmlResults = await fetchHtmlSearch(query, numResults);
            // Merge: prefer Instant Answer results, supplement with HTML results
            const allResults = mergeResults(instantResults, htmlResults, numResults);
            if (allResults.length === 0) {
                return { content: formatEmptyResult(query) };
            }
            return { content: formatResults(query, allResults) };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Search error: ${msg}`, isError: true };
        }
    },
};
// ── DuckDuckGo Instant Answer API ──
async function fetchInstantAnswer(query) {
    const results = [];
    try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok)
            return results;
        const data = (await response.json());
        // Abstract / Instant Answer
        if (data.AbstractText || data.Abstract) {
            results.push({
                title: data.Heading || data.AbstractSource || 'Instant Answer',
                snippet: (data.AbstractText || data.Abstract || '').replace(/<[^>]+>/g, ''),
                url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            });
        }
        // Definition
        if (data.Definition) {
            results.push({
                title: data.DefinitionSource || 'Definition',
                snippet: data.Definition.replace(/<[^>]+>/g, ''),
                url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            });
        }
        // Answer (e.g., calculations, conversions)
        if (data.Answer) {
            results.push({
                title: 'Answer',
                snippet: data.Answer,
                url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            });
        }
        // Top results
        if (data.Results) {
            for (const r of data.Results.slice(0, 5)) {
                if (r.Text) {
                    results.push({
                        title: extractTitle(r.Text),
                        snippet: stripHtmlTags(r.Text),
                        url: r.FirstURL || '',
                    });
                }
            }
        }
        // Related topics (flatten nested)
        if (data.RelatedTopics) {
            const flatTopics = [];
            for (const topic of data.RelatedTopics) {
                if (topic.Topics) {
                    flatTopics.push(...topic.Topics);
                }
                else if (topic.Text) {
                    flatTopics.push(topic);
                }
            }
            for (const t of flatTopics.slice(0, 8)) {
                if (t.Text) {
                    results.push({
                        title: extractTitle(t.Text),
                        snippet: stripHtmlTags(t.Text),
                        url: t.FirstURL || '',
                    });
                }
            }
        }
    }
    catch {
        // Instant answer failed — will fall back to HTML search
    }
    return results;
}
// ── DuckDuckGo HTML (Lite) Search Fallback ──
async function fetchHtmlSearch(query, numResults) {
    const results = [];
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'LingJing/1.0 (AI Coding Assistant)',
            },
        });
        clearTimeout(timer);
        if (!response.ok)
            return results;
        const html = await response.text();
        const parsed = parseDdgHtml(html, numResults);
        results.push(...parsed);
    }
    catch {
        // HTML search failed — return what we have from Instant Answer
    }
    return results;
}
// ── HTML Parsing ──
function parseDdgHtml(html, maxResults) {
    const results = [];
    // Extract result blocks: each result is in a div with class "result" or within "result__body"
    // DDG HTML lite uses older markup: <a class="result__a"> for title, <a class="result__snippet"> for snippet
    // Pattern: match <a class="result__a" href="URL">Title</a> followed by snippet
    const resultBlockRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = resultBlockRegex.exec(html)) !== null && results.length < maxResults) {
        const rawUrl = match[1];
        const title = stripHtmlTags(match[2]).trim();
        const snippet = stripHtmlTags(match[3]).trim();
        if (title && snippet) {
            // Clean up DDG redirect URLs
            const url = decodeDdgUrl(rawUrl);
            results.push({ title, snippet, url });
        }
    }
    // Fallback pattern: broader result extraction
    if (results.length === 0) {
        const broadRegex = /<a[^>]*class="[^"]*result[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<[^>]*class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>)/gi;
        while ((match = broadRegex.exec(html)) !== null && results.length < maxResults) {
            const title = stripHtmlTags(match[2]).trim();
            const snippet = stripHtmlTags(match[3] || '').trim();
            const url = decodeDdgUrl(match[1]);
            if (title && snippet && !url.includes('duckduckgo.com/y.js')) {
                results.push({ title, snippet, url });
            }
        }
    }
    return results;
}
// ── Helpers ──
function mergeResults(instant, html, maxResults) {
    const seenUrls = new Set();
    const merged = [];
    for (const r of [...instant, ...html]) {
        const normalizedUrl = r.url.replace(/\/$/, ''); // normalize trailing slash
        if (seenUrls.has(normalizedUrl))
            continue;
        if (merged.length >= maxResults)
            break;
        seenUrls.add(normalizedUrl);
        merged.push(r);
    }
    return merged;
}
function extractTitle(text) {
    // e.g., "Title — Snippet text..."
    const parts = text.split(/ [—–-] /);
    if (parts.length >= 2 && parts[0].length < 120) {
        return stripHtmlTags(parts[0]).trim();
    }
    // First sentence
    const sentence = text.split(/[.!?]\s/)[0];
    return stripHtmlTags(sentence).trim().slice(0, 100);
}
function stripHtmlTags(str) {
    return str
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/\s+/g, ' ')
        .trim();
}
function decodeDdgUrl(rawUrl) {
    // DDG redirects: //duckduckgo.com/l/?uddg=https://example.com&...
    const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
    if (uddgMatch) {
        try {
            return decodeURIComponent(uddgMatch[1]);
        }
        catch {
            return rawUrl;
        }
    }
    // Protocol-relative URL
    if (rawUrl.startsWith('//')) {
        return 'https:' + rawUrl;
    }
    return rawUrl;
}
function formatResults(query, results) {
    const lines = [];
    lines.push(`## Web Search Results for: "${query}"`);
    lines.push(`*${results.length} result(s) found*`);
    lines.push('');
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        lines.push(`### ${i + 1}. ${r.title}`);
        lines.push(r.snippet);
        if (r.url) {
            lines.push(`🔗 ${r.url}`);
        }
        lines.push('');
    }
    // Hint for the LLM
    lines.push('---');
    lines.push('*Tip: Use `web_fetch` with any URL above to get the full page content for deeper analysis.*');
    return lines.join('\n');
}
function formatEmptyResult(query) {
    return `## Web Search Results for: "${query}"\n\n*0 results found*\n\nNo results were returned for this query. Suggestions:\n- Try different keywords or shorter phrases\n- Rephrase your question\n- Use \`web_fetch\` to directly visit a known URL for information`;
}
//# sourceMappingURL=web-search.js.map