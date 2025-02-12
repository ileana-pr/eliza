import type { Provider, Memory, IAgentRuntime } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import type { MemeTokenData } from "../types";
import { SYSTEM_ROOM_ID } from "../evaluators/is-new-meme-token";
import axios, { AxiosInstance } from "axios";

// Interfaces to match Birdeye v2 API response structure
interface TokenSecurity {
    top10HolderPercent: number;
    rugged: boolean;
    honeypot: boolean;
}

interface TokenV2Data {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    price: number;
    mc: number;
    v24h: number;
    priceChange24h: number;
    holders: number;
    liquidity: number;
    security?: TokenSecurity;
    isScam?: boolean;
    createdAt?: number;
}

interface BirdeyeResponse {
    success: boolean;
    message?: string;
    tokens: TokenV2Data[];
}

interface TokenV1Data {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    price: number;
    lastTradeUnixTime: number;
    liquidity: number;
    mc: number;
    v24hChangePercent: number;
    v24hUSD: number;
}

interface BirdeyeV1Response {
    success: boolean;
    data: {
        updateUnixTime: number;
        updateTime: string;
        tokens: TokenV1Data[];
    };
}

export interface MemeTokenProviderAPI {
    getTrackedTokens(): Promise<MemeTokenData[]>;
    getConfig(): {
        minMarketCap: number;
        priceChangeThreshold: number;
        holderIncreaseThreshold: number;
        longTermHolderThreshold: number;
    };
}

// Create configured axios instance
const createBirdeyeClient = (apiKey: string): AxiosInstance => {
    // Remove any quotes that might be in the API key
    const cleanApiKey = apiKey.replace(/['"]/g, '').trim();
    
    const client = axios.create({
        baseURL: 'https://public-api.birdeye.so',
        headers: {
            'X-API-KEY': cleanApiKey,
            'Accept': 'application/json',
            'x-chain': 'solana'
        }
    });

    // Helper function to check if content is HTML
    const isHtmlContent = (content: any): boolean => {
        if (typeof content !== 'string') return false;
        return content.trim().toLowerCase().startsWith('<!doctype html') || 
               content.includes('</html>') ||
               content.includes('</body>') ||
               content.includes('<script');
    };

    // Add response interceptor for better error handling
    client.interceptors.response.use(
        (response) => {
            // Check if response data is HTML (shouldn't happen in success case, but just in case)
            if (isHtmlContent(response.data)) {
                throw new Error('Received HTML response instead of JSON data');
            }
            
            if (response.data?.success === false) {
                throw new Error(response.data.message || 'API request failed');
            }
            return response;
        },
        (error) => {
            if (error.response) {
                const status = error.response.status;
                
                // Don't log anything if the response is HTML
                if (isHtmlContent(error.response.data)) {
                    throw new Error(`API Error: ${status} - Received HTML response instead of JSON data`);
                }

                if (status === 401) {
                    throw new Error('API Error: Unauthorized - Please check your API key');
                } else if (status === 429) {
                    throw new Error('API Error: Rate limit exceeded - Please try again later');
                } else {
                    // Only log JSON error responses
                    if (typeof error.response.data === 'object') {
                        const errorMessage = error.response.data.message || error.response.statusText;
                        throw new Error(`API Error ${status}: ${errorMessage}`);
                    } else {
                        throw new Error(`API Error ${status}: ${error.response.statusText}`);
                    }
                }
            } else if (error.request) {
                throw new Error('No response received from API');
            } else {
                throw new Error(`Request error: ${error.message}`);
            }
        }
    );

    return client;
};

export const memeTokenProvider: Provider = {
    get: async (context: IAgentRuntime) => {
        const birdeyeApiKey = context.getSetting("BIRDEYE_API_KEY");
        if (!birdeyeApiKey) {
            throw new Error("Birdeye API key not configured");
        }

        // Create API client
        const birdeyeClient = createBirdeyeClient(birdeyeApiKey);

        return {
            async getTrackedTokens() {
                try {
                    const searchLimit = context.getSetting("BIRDEYE_SEARCH_LIMIT") || "50";
                    
                    elizaLogger.info("Fetching token data from Birdeye API...");
                    const response = await birdeyeClient.get('/defi/tokenlist', {
                        params: {
                            sort_by: 'v24hUSD',
                            sort_type: 'desc',
                            offset: 0,
                            limit: parseInt(searchLimit),
                            min_liquidity: 100
                        }
                    });

                    if (!response.data?.success || !response.data?.data?.tokens) {
                        elizaLogger.warn("No tokens found in response");
                        return [];
                    }

                    const tokens: MemeTokenData[] = [];
                    for (const token of response.data.data.tokens) {
                        if (!token.address || !token.symbol) {
                            continue;
                        }

                        tokens.push({
                            address: token.address,
                            symbol: token.symbol,
                            name: token.name || token.symbol,
                            price: Number(token.price) || 0,
                            marketCap: Number(token.mc) || 0,
                            volume24h: Number(token.v24hUSD) || 0,
                            priceChange24h: Number(token.v24hChangePercent) || 0,
                            holders: 0,
                            createdAt: new Date(),
                            lastUpdated: new Date(response.data.data.updateTime),
                            holderDistribution: 'stable',
                            topHolderConcentration: 0,
                            isDexListed: true,
                            liquidityUSD: Number(token.liquidity) || 0,
                            uniqueWallets24h: 0
                        });
                    }

                    elizaLogger.info(`Found ${tokens.length} valid tokens`);
                    return tokens;
                } catch (error) {
                    elizaLogger.error("Failed to fetch tokens:", error.message);
                    return [];
                }
            },

            isSecurityRisk(security: TokenSecurity | undefined): boolean {
                if (!security) return false; // Changed to false as v2 API might not always provide security info
                
                // Consider it a risk if:
                // 1. Top 10 holders own more than 80% of supply
                // 2. Token is marked as rugged
                // 3. Token is marked as honeypot
                return (
                    security.top10HolderPercent > 80 ||
                    security.rugged ||
                    security.honeypot
                );
            },

            getConfig() {
                return {
                    minMarketCap: 10000000, // $10M minimum market cap
                    priceChangeThreshold: 10, // 10% price change threshold
                    holderIncreaseThreshold: 5, // 5% holder increase threshold
                    longTermHolderThreshold: 5 // 5% long-term holder threshold
                };
            }
        };
    }
}; 