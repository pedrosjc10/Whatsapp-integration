/**
 * WhatsApp Store - Gerencia o estado das sessões e filtros
 */

const instances = new Map();

// Filtros dinâmicos (iniciam com o que está no .env)
let filterKeywords = process.env.TRELLO_FILTER_KEYWORDS ?
    process.env.TRELLO_FILTER_KEYWORDS.toLowerCase().split(",").map(k => k.trim()) : [];
let filterMediaTypes = process.env.TRELLO_FILTER_MEDIA_TYPES ?
    process.env.TRELLO_FILTER_MEDIA_TYPES.toLowerCase().split(",").map(t => t.trim()) : [];

// Timestamp de quando o bot ligou
const startupTimestamp = Math.floor(Date.now() / 1000);

module.exports = {
    instances,
    getFilters: () => ({ keywords: filterKeywords, mediaTypes: filterMediaTypes }),
    setFilters: (keywords, mediaTypes) => {
        if (Array.isArray(keywords)) filterKeywords = keywords.map(k => k.toLowerCase().trim());
        if (Array.isArray(mediaTypes)) filterMediaTypes = mediaTypes.map(t => t.toLowerCase().trim());
        return { keywords: filterKeywords, mediaTypes: filterMediaTypes };
    },
    startupTimestamp
};
